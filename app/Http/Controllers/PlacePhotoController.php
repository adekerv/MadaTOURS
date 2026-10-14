<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\AdminLog;
use App\Services\PlacePhotos;
use App\Services\SubmissionPhotos;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Owner photos with recorded permission, for administrators, and photo reports, which anyone may send
 * (notice-and-action under the EU Digital Services Act).
 */
class PlacePhotoController extends Controller
{
    private const CHANNELS = ['email', 'letter', 'form', 'in_person', 'message'];

    private const REASONS = ['not_this_place', 'copyright', 'privacy', 'offensive', 'other'];

    public function __construct(private SupabaseClient $db, private PlacePhotos $placePhotos) {}

    public function index(AuthService $auth): JsonResponse
    {
        Gate::authorize('manage-places');

        return response()->json([
            'permissions' => $this->db->request('GET', '/rest/v1/mt_photo_permissions', ['select' => 'id,place_id,basis,grantor_name,grantor_role,business,licence_version,channel,granted_on,expires_on,revoked_at,recorded_at,image_path', 'order' => 'recorded_at.desc', 'limit' => 50], $auth->token()),
            'reports' => $this->db->request('GET', '/rest/v1/mt_photo_reports', ['status' => 'eq.open', 'order' => 'created_at.asc', 'limit' => 50], $auth->token()),
        ]);
    }

    public function store(Request $request, SubmissionPhotos $photos, AdminLog $log): JsonResponse
    {
        Gate::authorize('manage-places');
        $input = $request->validate([
            'placeId' => 'required|integer|min:1|max:9007199254740991',
            'photo' => 'required|string|max:2796204',
            'evidence' => 'nullable|string|max:5592408',
            'grantorName' => 'required|string|max:200',
            'grantorRole' => 'nullable|string|max:120',
            'business' => 'nullable|string|max:200',
            'licenceVersion' => 'required|string|max:100',
            'channel' => ['required', Rule::in(self::CHANNELS)],
            'grantedOn' => 'required|date_format:Y-m-d|before_or_equal:today',
            'expiresOn' => 'nullable|date_format:Y-m-d|after:grantedOn',
            'credit' => 'required|string|max:200',
            'sourceUrl' => 'required|url:https|max:2000',
            'confirmed' => 'accepted',
        ]);
        $jpeg = $photos->sanitize($input['photo']);
        $result = $this->placePhotos->publish((int) $input['placeId'], $jpeg, [
            'author' => $input['credit'], 'license' => 'Used with permission', 'licenseUrl' => $input['sourceUrl'], 'sourceUrl' => $input['sourceUrl'],
        ], [
            'basis' => 'permission', 'grantor_name' => $input['grantorName'], 'grantor_role' => $input['grantorRole'] ?? null,
            'business' => $input['business'] ?? null, 'licence_version' => $input['licenceVersion'], 'channel' => $input['channel'],
            'granted_on' => $input['grantedOn'], 'expires_on' => $input['expiresOn'] ?? null,
        ], isset($input['evidence']) ? $this->evidence($input['evidence']) : null, $request->user()->id);
        $log->record('photos.publish', 'Published an owner photo for place #'.$input['placeId'], 'place', $input['placeId'], ['grantor' => $input['grantorName']]);

        return response()->json($result, 201);
    }

    public function revoke(Request $request, AdminLog $log): JsonResponse
    {
        Gate::authorize('manage-places');
        $input = $request->validate(['id' => 'required|uuid']);
        $this->placePhotos->revoke($input['id']);
        $log->record('photos.revoke', 'Took down an owner photo', 'photo-permission', $input['id']);

        return response()->json(['success' => true]);
    }

    public function report(Request $request, AuthService $auth): JsonResponse
    {
        $input = $request->validate([
            'placeId' => 'required|integer|min:1|max:9007199254740991',
            'image' => 'required|string|max:2000',
            'reason' => ['required', Rule::in(self::REASONS)],
            'details' => 'nullable|string|max:1000',
            'contact' => 'nullable|string|max:200',
        ]);
        $auth->limit('photo-report', 'place:'.$input['placeId'], 20);
        $place = $this->db->request('GET', '/rest/v1/mt_places', ['select' => 'id,image', 'id' => 'eq.'.$input['placeId'], 'published' => 'eq.true', 'limit' => 1], admin: true);
        if (! $place) {
            throw new ApiException(404, 'Place not found.');
        }
        // A report names the photo the person saw: the place's own photo or one of the library's illustrations.
        $image = $input['image'];
        $shown = $image === ($place[0]['image'] ?? null) || preg_match('#^/assets/placeholders/[a-z0-9-]+-v[0-9]+\.(webp|jpg)$#', $image);
        if (! $shown) {
            throw new ApiException(422, 'This photo is no longer shown for this place.');
        }
        $this->db->request('POST', '/rest/v1/mt_photo_reports', [
            'place_id' => (int) $input['placeId'], 'image' => $image, 'reason' => $input['reason'],
            'details' => $input['details'] ?? null, 'contact' => $input['contact'] ?? null,
        ], admin: true);

        return response()->json(['success' => true], 201);
    }

    public function resolve(Request $request, AdminLog $log, string $report): JsonResponse
    {
        Gate::authorize('manage-places');
        validator(['report' => $report], ['report' => 'required|integer|min:1'])->validate();
        $input = $request->validate(['status' => ['required', Rule::in(['resolved', 'dismissed'])]]);
        $this->db->request('PATCH', '/rest/v1/mt_photo_reports?id=eq.'.$report, ['status' => $input['status'], 'resolved_at' => now()->toIso8601String(), 'resolved_by' => $request->user()->id], admin: true);
        $log->record('photos.report', ucfirst($input['status']).' photo report #'.$report, 'photo-report', $report);

        return response()->json(['success' => true]);
    }

    /** @return array{bytes: string, extension: string, mime: string} */
    private function evidence(string $base64): array
    {
        $bytes = base64_decode($base64, true);
        if ($bytes === false || strlen($bytes) > 4194304) {
            throw new ApiException(422, 'Attach the permission as a JPEG, PNG or PDF under 4 MB.');
        }
        foreach (["\xFF\xD8\xFF" => ['jpg', 'image/jpeg'], "\x89PNG\r\n\x1A\n" => ['png', 'image/png'], '%PDF-' => ['pdf', 'application/pdf']] as $magic => [$extension, $mime]) {
            if (str_starts_with($bytes, $magic)) {
                return ['bytes' => $bytes, 'extension' => $extension, 'mime' => $mime];
            }
        }
        throw new ApiException(422, 'Attach the permission as a JPEG, PNG or PDF under 4 MB.');
    }
}
