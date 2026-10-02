<?php

namespace App\Http\Controllers;

use App\Services\Sources\PublicSourceClient;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class EnrichmentController extends Controller
{
    public function __construct(private SupabaseClient $db) {}

    public function picks(): JsonResponse
    {
        return response()->json(['picks' => $this->db->request('GET', '/rest/v1/mt_daily_picks', ['order' => 'position.asc', 'limit' => 5])]);
    }

    public function index(Request $request, AuthService $auth): JsonResponse
    {
        Gate::authorize('manage-places');
        $query = ['order' => 'place_id.asc', 'limit' => 20, 'offset' => min(10000, max(0, $request->integer('offset')))];
        $data = [];
        foreach (['sources' => 'mt_source_settings', 'matches' => 'mt_google_matches'] as $key => $table) {
            $data[$key] = $this->db->request('GET', '/rest/v1/'.$table, $query, $auth->token());
        }
        $data['logs'] = $this->db->request('GET', '/rest/v1/mt_source_logs', ['order' => 'created_at.desc', 'limit' => 20, 'offset' => $query['offset']], $auth->token());

        return response()->json($data);
    }

    public function store(Request $request, PublicSourceClient $http, string $action): JsonResponse
    {
        Gate::authorize('manage-places');
        $input = $request->validate(match ($action) {
            'source' => ['placeId' => 'required|integer|min:1', 'url' => 'required|url:https|max:2000', 'enabled' => 'required|boolean'],
            'google' => ['placeId' => 'required|integer|min:1', 'placeIdGoogle' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{10,255}$/'], 'excluded' => 'required|boolean'],
            'photo' => ['placeId' => 'required|integer|min:1', 'rights' => 'accepted', 'author' => 'required|string|max:200', 'license' => 'required|string|max:100', 'licenseUrl' => 'required|url:https|max:2000'],
            default => abort(404),
        });
        $id = (int) $input['placeId'];
        if ($action === 'source') {
            try {
                // Pausing an unavailable source must not depend on that source's DNS.
                if ($input['enabled']) {
                    $http->validate($input['url']);
                }
            } catch (RuntimeException) {
                throw ValidationException::withMessages(['url' => 'Use a public HTTPS official source. Google Maps pages cannot be ingested.']);
            }
            $this->db->request('POST', '/rest/v1/mt_source_settings?on_conflict=place_id', ['place_id' => $id, 'url' => $input['url'], 'enabled' => $input['enabled'], 'next_check_at' => now()->toIso8601String(), 'candidate_photo' => null, 'updated_at' => now()->toIso8601String()], admin: true, headers: ['Prefer' => 'resolution=merge-duplicates']);
        } elseif ($action === 'google') {
            $google = $input['excluded'] ? null : ($input['placeIdGoogle'] ?? null);
            $this->db->request('PATCH', '/rest/v1/mt_places?id=eq.'.$id, ['google_place_id' => $google], admin: true);
            $this->db->request('POST', '/rest/v1/mt_google_matches?on_conflict=place_id', ['place_id' => $id, 'status' => $input['excluded'] ? 'excluded' : ($google ? 'matched' : 'pending'), 'candidate_ids' => [], 'checked_at' => now()->toIso8601String(), 'next_check_at' => now()->toIso8601String()], admin: true, headers: ['Prefer' => 'resolution=merge-duplicates']);
        } else {
            $rows = $this->db->request('GET', '/rest/v1/mt_source_settings', ['place_id' => 'eq.'.$id, 'limit' => 1], admin: true);
            $photo = $rows[0]['candidate_photo'] ?? null;
            abort_unless($photo, 404);
            try {
                $http->validate($photo['url']);
            } catch (RuntimeException) {
                abort(422);
            }
            $this->db->request('PATCH', '/rest/v1/mt_places?id=eq.'.$id, ['image' => $photo['url'], 'photo_credit' => ['author' => $input['author'], 'license' => $input['license'], 'sourceUrl' => $photo['source'], 'licenseUrl' => $input['licenseUrl'], 'caption' => '']], admin: true);
            $this->db->request('PATCH', '/rest/v1/mt_source_settings?place_id=eq.'.$id, ['candidate_photo' => null], admin: true);
            $this->db->request('POST', '/rest/v1/mt_source_logs', ['place_id' => $id, 'status' => 'photo_approved'], admin: true);
        }

        return response()->json(['success' => true]);
    }
}
