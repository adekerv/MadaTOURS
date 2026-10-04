<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\SubmissionPhotos;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Photos attached to reviews. Reviews themselves are public (CommunityController); their photos are
 * for signed-in people only. Every route here sits behind the sign-in middleware, the database
 * function and table refuse guests as well, and the files are in a private bucket reached only
 * through short-lived signed links. The public community feed never mentions photos at all.
 */
class ReviewPhotoController extends Controller
{
    private const LIMIT = 3;

    public function __construct(private SupabaseClient $client, private SubmissionPhotos $photos) {}

    public function index(Request $request, AuthService $auth, string $place): JsonResponse
    {
        $input = validator(['place' => $place, 'offset' => $request->integer('offset')], ['place' => 'required|integer|min:1|max:9007199254740991', 'offset' => 'integer|min:0|max:10000'])->validate();
        $rows = $this->client->request('POST', '/rest/v1/rpc/mt_place_review_photos', ['target_place' => (int) $input['place'], 'page_offset' => $input['offset']], $auth->token());

        return response()->json(['photos' => $this->withUrls($rows)]);
    }

    public function store(Request $request, AuthService $auth, string $review): JsonResponse
    {
        validator(['review' => $review], ['review' => 'required|integer|min:1|max:9007199254740991'])->validate();
        $data = $request->validate(['photo' => 'required|string|max:2796204']);
        $user = $request->user();
        $auth->limit('review-photo', $user->id);
        // People can read only their own review through RLS, and the filter keeps administrators to theirs too.
        $own = $this->client->request('GET', '/rest/v1/mt_reviews', ['select' => 'id', 'id' => 'eq.'.$review, 'user_id' => 'eq.'.$user->id, 'limit' => 1], $auth->token());
        if (! $own) {
            throw new ApiException(404, 'Review not found.');
        }
        $existing = $this->client->request('GET', '/rest/v1/mt_review_photos', ['select' => 'id', 'review_id' => 'eq.'.$review], $auth->token());
        if (count($existing) >= self::LIMIT) {
            throw new ApiException(422, 'A review can have up to 3 photos.');
        }
        $photo = $this->photos->upload($user->id, $data['photo'], 'mt_review_photos', ['review_id' => (int) $review]);
        $urls = $this->photos->signedUrls([$photo['path']]);

        return response()->json(['photo' => ['id' => $photo['id'], 'reviewId' => (int) $review, 'url' => $urls[$photo['path']] ?? null]], 201);
    }

    public function destroy(Request $request, string $photo): JsonResponse
    {
        validator(['photo' => $photo], ['photo' => 'required|uuid'])->validate();
        $rows = $this->client->request('GET', '/rest/v1/mt_review_photos', ['select' => 'id,user_id', 'id' => 'eq.'.$photo, 'limit' => 1], admin: true);
        $row = $rows[0] ?? null;
        if (! $row) {
            throw new ApiException(404, 'Photo not found.');
        }
        // The author may remove their own photo; administrators may remove any, since reviews go live at once.
        if ($row['user_id'] !== $request->user()->id && ! Gate::allows('manage-places')) {
            throw new ApiException(403, 'You can only remove your own photos.');
        }
        $this->client->request('DELETE', '/rest/v1/mt_review_photos?id=eq.'.rawurlencode($photo), admin: true);
        try {
            $this->photos->cleanup($row['user_id']);
        } catch (\Throwable) {
            // The file is already queued for deletion and the scheduled cleanup retries.
        }

        return response()->json(['success' => true]);
    }

    /** @param array<int, array{id: string, reviewId: int, path: string}> $rows */
    private function withUrls(array $rows): array
    {
        $urls = $this->photos->signedUrls(array_column($rows, 'path'));

        return array_values(array_filter(array_map(
            fn ($row) => isset($urls[$row['path']]) ? ['id' => $row['id'], 'reviewId' => $row['reviewId'], 'url' => $urls[$row['path']]] : null,
            $rows,
        )));
    }
}
