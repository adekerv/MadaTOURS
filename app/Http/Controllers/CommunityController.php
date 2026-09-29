<?php

namespace App\Http\Controllers;

use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class CommunityController extends Controller
{
    public function __construct(private SupabaseClient $client) {}

    public function show(Request $request, string $place): JsonResponse
    {
        $input = validator(['place' => $place, 'offset' => $request->integer('offset')], ['place' => 'required|integer|min:1|max:9007199254740991', 'offset' => 'integer|min:0|max:10000'])->validate();

        return response()->json($this->client->request('POST', '/rest/v1/rpc/mt_place_community', ['target_place' => (int) $input['place'], 'page_offset' => $input['offset']]));
    }

    public function mine(Request $request, AuthService $auth, string $place): JsonResponse
    {
        validator(['place' => $place], ['place' => 'required|integer|min:1|max:9007199254740991'])->validate();
        $rows = $this->client->request('GET', '/rest/v1/mt_reviews', ['user_id' => 'eq.'.$request->user()->id, 'place_id' => 'eq.'.$place, 'limit' => 1], $auth->token());

        return response()->json(['review' => $rows[0] ?? null]);
    }

    public function store(Request $request, AuthService $auth, string $action): JsonResponse
    {
        $rules = match ($action) {
            'review' => ['placeId' => 'required|integer|min:1', 'rating' => 'required|integer|between:1,5', 'body' => 'required|string|min:10|max:2000'],
            'comment' => ['placeId' => 'required|integer|min:1', 'body' => 'required|string|min:2|max:1000'],
            'checkin' => ['placeId' => 'required|integer|min:1'],
            'delete-review', 'delete-comment' => ['id' => 'required|integer|min:1'],
            'moderate-review' => ['id' => 'required|integer|min:1', 'rating' => 'required|integer|between:1,5', 'body' => 'required|string|min:10|max:2000'],
            'block-comments' => ['userId' => 'required|uuid', 'reason' => 'required|string|min:3|max:500'],
            'unblock-comments' => ['userId' => 'required|uuid'],
            default => abort(404),
        };
        if (in_array($action, ['moderate-review', 'block-comments', 'unblock-comments'], true)) {
            Gate::authorize('manage-places');
        }
        $data = $request->validate($rules);

        return response()->json($this->client->request('POST', '/rest/v1/rpc/mt_community_write', ['action' => $action, 'payload' => $data], $auth->token()));
    }

    public function moderation(Request $request, AuthService $auth): JsonResponse
    {
        Gate::authorize('manage-places');
        $offset = min(10000, max(0, $request->integer('offset')));
        $rows = [];
        foreach (['reviews' => 'mt_reviews', 'comments' => 'mt_comments', 'blocked' => 'mt_comment_blocks'] as $key => $table) {
            $rows[$key] = $this->client->request('GET', '/rest/v1/'.$table, ['order' => 'created_at.desc', 'limit' => 20, 'offset' => $offset], $auth->token());
        }

        return response()->json($rows);
    }
}
