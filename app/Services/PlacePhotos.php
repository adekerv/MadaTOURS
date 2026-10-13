<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Services\Supabase\StorageClient;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Str;
use Throwable;

/**
 * A place's own photo, published only with a recorded permission (mt_photo_permissions). The photo is re-encoded,
 * self-hosted in a public bucket that only the service role writes, and credited with basis "permission". Revoking
 * or expiring the permission takes the photo down again.
 */
class PlacePhotos
{
    public const BUCKET = 'mt-place-photos';

    public const EVIDENCE = 'mt-photo-evidence';

    public function __construct(private SupabaseClient $db, private StorageClient $storage) {}

    /**
     * @param  array{author: string, license: string, licenseUrl: string, sourceUrl: string, caption?: string}  $credit
     * @param  array{basis: string, grantor_name: string, grantor_role?: ?string, business?: ?string, licence_version: string, channel: string, granted_on: string, expires_on?: ?string}  $permission
     * @param  array{bytes: string, extension: string, mime: string}|null  $evidence
     * @return array{id: string, image: string}
     */
    public function publish(int $placeId, string $jpeg, array $credit, array $permission, ?array $evidence, string $recordedBy): array
    {
        $place = $this->db->request('GET', '/rest/v1/mt_places', ['select' => 'id', 'id' => 'eq.'.$placeId, 'limit' => 1], admin: true);
        if (! $place) {
            throw new ApiException(404, 'Place not found.');
        }
        $id = (string) Str::uuid();
        $path = 'places/'.$placeId.'-'.$id.'.jpg';
        $evidencePath = $evidence ? 'evidence/'.Str::uuid().'.'.$evidence['extension'] : null;
        $uploaded = [];
        try {
            $this->put(self::BUCKET, $path, $jpeg, 'image/jpeg');
            $uploaded[] = [self::BUCKET, $path];
            if ($evidence) {
                $this->put(self::EVIDENCE, $evidencePath, $evidence['bytes'], $evidence['mime']);
                $uploaded[] = [self::EVIDENCE, $evidencePath];
            }
            $previous = $this->db->request('GET', '/rest/v1/mt_photo_permissions', ['select' => 'id,image_path', 'place_id' => 'eq.'.$placeId, 'revoked_at' => 'is.null'], admin: true);
            $this->db->request('POST', '/rest/v1/mt_photo_permissions', [
                'id' => $id, 'place_id' => $placeId, 'file_sha256' => hash('sha256', $jpeg), 'image_path' => $path,
                'evidence_path' => $evidencePath, 'recorded_by' => $recordedBy, ...$permission,
            ], admin: true);
            $image = $this->storage->publicUrl(self::BUCKET, $path);
            $this->db->request('PATCH', '/rest/v1/mt_places?id=eq.'.$placeId, ['image' => $image, 'photo_credit' => [
                'author' => $credit['author'], 'license' => $credit['license'], 'licenseUrl' => $credit['licenseUrl'],
                'sourceUrl' => $credit['sourceUrl'], 'caption' => $credit['caption'] ?? '', 'basis' => 'permission',
                'modified' => 're-encoded', 'retrievedAt' => now()->toDateString(),
            ]], admin: true);
        } catch (Throwable $error) {
            foreach ($uploaded as [$bucket, $file]) {
                $this->remove($bucket, $file);
            }
            throw $error;
        }
        // The newer photo replaces the older ones: their files go, their records stay as history.
        foreach ($previous as $old) {
            $this->db->request('PATCH', '/rest/v1/mt_photo_permissions?id=eq.'.$old['id'], ['revoked_at' => now()->toIso8601String()], admin: true);
            $this->remove(self::BUCKET, $old['image_path']);
        }

        return ['id' => $id, 'image' => $image];
    }

    /** Withdraws a permission: the photo leaves the place and its public file is deleted. */
    public function revoke(string $permissionId): void
    {
        $rows = $this->db->request('GET', '/rest/v1/mt_photo_permissions', ['select' => 'id,place_id,image_path,revoked_at', 'id' => 'eq.'.$permissionId, 'limit' => 1], admin: true);
        $permission = $rows[0] ?? null;
        if (! $permission) {
            throw new ApiException(404, 'Permission not found.');
        }
        if ($permission['revoked_at']) {
            return;
        }
        $this->db->request('PATCH', '/rest/v1/mt_photo_permissions?id=eq.'.$permission['id'], ['revoked_at' => now()->toIso8601String()], admin: true);
        $image = $this->storage->publicUrl(self::BUCKET, $permission['image_path']);
        // Only the photo this permission covers is taken down, never a newer one.
        $this->db->request('PATCH', '/rest/v1/mt_places?id=eq.'.$permission['place_id'].'&image=eq.'.rawurlencode($image), ['image' => null, 'photo_credit' => null], admin: true);
        $this->remove(self::BUCKET, $permission['image_path']);
    }

    /** Takes down photos whose permission has expired. */
    public function expire(): int
    {
        $due = $this->db->request('GET', '/rest/v1/mt_photo_permissions', ['select' => 'id', 'revoked_at' => 'is.null', 'expires_on' => 'lt.'.now()->toDateString(), 'limit' => 100], admin: true);
        foreach ($due as $permission) {
            $this->revoke($permission['id']);
        }

        return count($due);
    }

    private function put(string $bucket, string $path, string $bytes, string $mime): void
    {
        try {
            $response = $this->storage->request()->withBody($bytes, $mime)->post('/object/'.$bucket.'/'.$path);
        } catch (ConnectionException) {
            throw new ApiException(503, 'Photo upload failed. Please try again.');
        }
        if (! $response->successful()) {
            throw new ApiException(503, 'Photo upload failed. Please try again.');
        }
    }

    private function remove(string $bucket, string $path): void
    {
        try {
            $this->storage->request()->delete('/object/'.$bucket, ['prefixes' => [$path]]);
        } catch (Throwable) {
            // A leftover file is harmless: its address is unguessable and no place points at it.
        }
    }
}
