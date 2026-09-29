<?php

namespace App\Http\Controllers;

use App\Services\SubmissionPhotos;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class SubmissionController extends Controller
{
    public function __construct(private SupabaseClient $client, private SubmissionPhotos $photos) {}

    public function index(Request $request, AuthService $auth): JsonResponse
    {
        $offset = min(10000, max(0, $request->integer('offset')));
        $query = ['order' => 'created_at.desc', 'limit' => 20, 'offset' => $offset];
        if ($request->boolean('moderation')) {
            Gate::authorize('manage-places');
            $query['status'] = 'eq.pending';
        } else {
            $query['user_id'] = 'eq.'.$request->user()->id;
        }
        $rows = $this->client->request('GET', '/rest/v1/mt_submissions', $query, $auth->token());
        $urls = $this->photos->signedUrls(array_map(fn ($row) => $row['user_id'].'/'.$row['photo_id'].'.jpg', $rows));
        foreach ($rows as &$row) {
            $row['photoUrl'] = $urls[$row['user_id'].'/'.$row['photo_id'].'.jpg'] ?? null;
        }
        $notifications = $this->client->request('GET', '/rest/v1/mt_notifications', ['order' => 'created_at.desc', 'limit' => 20, 'offset' => $offset], $auth->token());

        return response()->json(['submissions' => $rows, 'notifications' => $notifications]);
    }

    public function store(Request $request, AuthService $auth): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|min:3|max:160', 'type' => 'required|in:restaurant,activity,cultural',
            'lat' => 'required|numeric|between:14.35,14.95', 'lng' => 'required|numeric|between:-61.3,-60.75',
            'address' => 'required|string|min:5|max:200', 'description' => 'required|string|min:40|max:3000',
            'language' => 'required|in:en,fr', 'sourceUrl' => 'nullable|url:https|max:1000',
            'imageBase64' => 'required|string|max:2796204', 'photoRights' => 'required|accepted',
        ]);
        $auth->limit('submission-upload', $request->user()->id);
        $photo = $this->photos->upload($request->user()->id, $data['imageBase64']);
        unset($data['imageBase64']);
        try {
            $result = $this->client->request('POST', '/rest/v1/rpc/mt_submission_write', ['action' => 'create', 'payload' => [...$data, 'photoId' => $photo['id']]], $auth->token());
        } catch (\Throwable $error) {
            // Cascade queues the orphaned file for cleanup if the insert fails.
            $this->client->request('DELETE', '/rest/v1/mt_submission_photos?id=eq.'.$photo['id'], admin: true);
            throw $error;
        }

        return response()->json($result, 201);
    }

    public function decide(Request $request, AuthService $auth, string $action): JsonResponse
    {
        Gate::authorize('manage-places');
        abort_unless(in_array($action, ['approve', 'reject'], true), 404);
        $rules = ['id' => 'required|integer|min:1'];
        $rules += $action === 'approve' ? ['description' => 'required|string|min:40|max:3000', 'descriptionFr' => 'required|string|min:40|max:3000'] : ['reason' => 'required|string|min:10|max:1000'];

        return response()->json($this->client->request('POST', '/rest/v1/rpc/mt_submission_write', ['action' => $action, 'payload' => [...$request->validate($rules), 'origin' => rtrim(config('supabase.app_origin'), '/')]], $auth->token()));
    }
}
