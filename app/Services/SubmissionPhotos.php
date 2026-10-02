<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SubmissionPhotos
{
    public function __construct(private SupabaseClient $client) {}

    private function storage(): PendingRequest
    {
        $url = config('supabase.url');
        $key = config('supabase.secret_key');
        $localTestServer = app()->environment('testing') && preg_match('#^http://127\.0\.0\.1:[0-9]+$#', $url);
        if ((! str_starts_with($url, 'https://') && ! $localTestServer) || ! $key) {
            throw new ApiException(503, 'Photo storage is not configured yet.');
        }
        $request = Http::baseUrl($url.'/storage/v1')->withHeaders(['apikey' => $key])->withoutRedirecting()->timeout(15)->connectTimeout(5);

        return str_starts_with($key, 'eyJ') ? $request->withToken($key) : $request;
    }

    public function sanitize(string $base64): string
    {
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg')) {
            throw new ApiException(503, 'Photo processing is temporarily unavailable. Please try again later.');
        }
        $bytes = base64_decode($base64, true);
        $size = $bytes === false ? false : @getimagesizefromstring($bytes);
        if (! $bytes || strlen($bytes) > 2097152 || ! $size || $size[0] * $size[1] > 9000000 || max($size[0], $size[1]) > 10000 || ! in_array($size['mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ApiException(422, 'Upload a JPEG, PNG or WebP photo under 2 MB.');
        }
        $original = @imagecreatefromstring($bytes);
        if (! $original) {
            throw new ApiException(422, 'This photo could not be read. Choose another photo.');
        }
        $width = max(1, (int) round($size[0] * min(1, 1600 / max($size[0], $size[1]))));
        $image = imagescale($original, $width);
        imagedestroy($original);
        ob_start();
        imagejpeg($image, null, 80);
        $jpeg = ob_get_clean();
        imagedestroy($image);
        if (! $jpeg || strlen($jpeg) > 2097152) {
            throw new ApiException(422, 'This photo is too large. Choose a smaller photo.');
        }

        // Re-encoding removes EXIF (including GPS), embedded profiles and ancillary data.
        return $jpeg;
    }

    public function upload(string $userId, string $base64): array
    {
        $id = (string) Str::uuid();
        $path = $userId.'/'.$id.'.jpg';
        $bytes = $this->sanitize($base64);
        try {
            $response = $this->storage()->withBody($bytes, 'image/jpeg')->post('/object/mt-submissions/'.$path);
            if (! $response->successful()) {
                throw new ApiException(503, 'Photo upload failed. Please try again.');
            }
            try {
                $this->client->request('POST', '/rest/v1/mt_submission_photos', ['id' => $id, 'user_id' => $userId, 'path' => $path], admin: true);
            } catch (\Throwable $error) {
                $this->storage()->delete('/object/mt-submissions', ['prefixes' => [$path]]);
                throw $error;
            }
        } catch (ConnectionException) {
            throw new ApiException(503, 'Photo upload failed. Please try again.');
        }

        return ['id' => $id, 'path' => $path];
    }

    public function signedUrls(array $paths): array
    {
        if (! $paths) {
            return [];
        }
        try {
            $response = $this->storage()->post('/object/sign/mt-submissions', ['paths' => array_values($paths), 'expiresIn' => 300]);
            if (! $response->successful()) {
                return [];
            }
            $urls = [];
            foreach ($response->json() ?? [] as $item) {
                $signed = $item['signedURL'] ?? null;
                if (in_array($item['path'] ?? null, $paths, true) && is_string($signed) && str_starts_with($signed, '/object/sign/mt-submissions/')) {
                    $urls[$item['path']] = config('supabase.url').'/storage/v1'.$signed;
                }
            }

            return $urls;
        } catch (ConnectionException) {
            return [];
        }
    }

    public function published(string $id): string
    {
        $rows = $this->client->request('GET', '/rest/v1/mt_submissions', ['select' => 'place_id,user_id', 'photo_id' => 'eq.'.$id, 'status' => 'eq.approved', 'limit' => 1], admin: true);
        $submission = $rows[0] ?? null;
        if (! $submission || ! $submission['place_id']) {
            abort(404);
        }
        $place = $this->client->request('GET', '/rest/v1/mt_places', ['select' => 'id', 'id' => 'eq.'.$submission['place_id'], 'published' => 'eq.true', 'limit' => 1]);
        if (! $place) {
            abort(404);
        }
        try {
            $response = $this->storage()->get('/object/mt-submissions/'.$submission['user_id'].'/'.$id.'.jpg');
        } catch (ConnectionException) {
            abort(503);
        }
        abort_unless($response->successful() && strlen($response->body()) <= 2097152, 404);

        return $response->body();
    }

    public function cleanup(?string $userId = null): int
    {
        $query = ['select' => 'path', 'limit' => 100];
        if ($userId) {
            $query['path'] = 'like.'.$userId.'/*';
        }
        $pending = $this->client->request('GET', '/rest/v1/mt_photo_deletions', $query, admin: true);
        $count = 0;
        foreach ($pending as $photo) {
            $response = $this->storage()->delete('/object/mt-submissions', ['prefixes' => [$photo['path']]]);
            if ($response->successful() || $response->status() === 404) {
                $this->client->request('DELETE', '/rest/v1/mt_photo_deletions?path=eq.'.rawurlencode($photo['path']), admin: true);
                $count++;
            }
        }

        return $count;
    }
}
