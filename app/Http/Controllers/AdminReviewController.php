<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Reviews publish at once, so there is nothing to approve: administrators hide a review (it stays stored and can be
 * shown again), edit it through the existing moderation action, or delete it.
 */
class AdminReviewController extends AdminController
{
    public function index(Request $request): JsonResponse
    {
        $query = $this->listQuery($request, ['newest', 'oldest', 'lowest', 'highest'], [
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'visibility' => ['nullable', Rule::in(['visible', 'hidden'])],
        ]);

        return response()->json($this->page($this->rpc('mt_admin_reviews', [
            'search_text' => $query['search'], 'rating_filter' => (int) ($query['filters']['rating'] ?? 0),
            'visibility' => $query['filters']['visibility'] ?? '', 'sort_key' => $query['sort'],
            'page_offset' => $query['offset'], 'page_size' => $query['perPage'],
        ]), $query));
    }

    public function update(string $id, string $action): JsonResponse
    {
        $review = $this->rpc('mt_admin_review_write', ['action' => $action, 'target' => $this->id($id)]);
        $this->log->record('reviews.'.$action, ($action === 'hide' ? 'Hid' : 'Showed again').' review #'.$id, 'review', $id, ['place' => $review['placeId'] ?? null]);

        return response()->json($review);
    }

    public function destroy(string $id): JsonResponse
    {
        $review = $this->rpc('mt_admin_review_write', ['action' => 'delete', 'target' => $this->id($id)]);
        $this->log->record('reviews.delete', 'Deleted review #'.$id, 'review', $id, ['place' => $review['placeId'] ?? null]);

        return response()->json(['success' => true]);
    }

    private function id(string $id): int
    {
        validator(['id' => $id], ['id' => 'required|integer|min:1|max:9007199254740991'])->validate();

        return (int) $id;
    }
}
