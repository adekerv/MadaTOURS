<?php

namespace App\Http\Controllers;

use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SocialController extends Controller
{
    public function __construct(private SupabaseClient $client) {}

    public function index(Request $request, AuthService $auth): JsonResponse
    {
        $input = $request->validate(['q' => 'nullable|string|max:80', 'offset' => 'sometimes|integer|min:0|max:10000']);

        return response()->json($this->client->request('POST', '/rest/v1/rpc/mt_social_dashboard', ['search_text' => $input['q'] ?? '', 'page_offset' => (int) ($input['offset'] ?? 0)], $auth->token()));
    }

    public function store(Request $request, AuthService $auth, string $action): JsonResponse
    {
        $rules = match ($action) {
            'follow', 'accept-follow', 'decline-follow', 'unfollow', 'remove-follower', 'block', 'unblock' => ['userId' => 'required|uuid'],
            'share-plan' => ['placeIds' => 'required|array|min:1|max:15', 'placeIds.*' => 'required|integer|min:1|distinct'],
            'clear-plan' => [],
            'create-event' => [
                'title' => 'required|string|min:3|max:120', 'description' => 'required|string|min:20|max:2000',
                'placeId' => 'nullable|integer|min:1', 'location' => 'required_without:placeId|nullable|string|min:3|max:200',
                'lat' => 'required_without:placeId|nullable|numeric|between:14.35,14.95', 'lng' => 'required_without:placeId|nullable|numeric|between:-61.3,-60.75',
                'startsAt' => 'required|date|after:now|before:+90 days', 'price' => 'required|numeric|between:0,10000',
                'capacity' => 'required|integer|between:2,100', 'lifetimeHours' => 'required|integer|in:3,6,24,168',
            ],
            'apply', 'leave-event', 'cancel-event' => ['eventId' => 'required|integer|min:1'],
            'approve', 'decline' => ['eventId' => 'required|integer|min:1', 'userId' => 'required|uuid'],
            'report' => ['eventId' => 'required|integer|min:1', 'reason' => 'required|string|min:10|max:1000'],
            default => abort(404),
        };
        if (in_array($action, ['apply', 'report'], true) && ! $request->user()->emailVerified) {
            return response()->json(['error' => 'Verify your email to use meet-ups.'], 403);
        }

        return response()->json($this->client->request('POST', '/rest/v1/rpc/mt_social_write', ['action' => $action, 'payload' => $request->validate($rules)], $auth->token()));
    }
}
