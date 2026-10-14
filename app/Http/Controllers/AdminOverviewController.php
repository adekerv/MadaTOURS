<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\PlacePhotos;
use App\Services\SubmissionPhotos;
use App\Services\Supabase\StorageClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** The dashboard's figures, the activity log, and image uploads for tours and the homepage. */
class AdminOverviewController extends AdminController
{
    private const AREAS = ['users', 'tours', 'places', 'meetups', 'reviews', 'messages', 'settings', 'submissions', 'photos', 'community'];

    public function overview(): JsonResponse
    {
        return response()->json($this->rpc('mt_admin_overview'));
    }

    public function log(Request $request): JsonResponse
    {
        $query = $this->listQuery($request, ['newest'], ['area' => ['nullable', Rule::in(self::AREAS)]]);

        return response()->json($this->page($this->rpc('mt_admin_log_list', [
            'search_text' => $query['search'], 'area' => $query['filters']['area'] ?? '',
            'page_offset' => $query['offset'], 'page_size' => $query['perPage'],
        ]), $query));
    }

    /**
     * Re-encodes an image (which drops camera metadata) and stores it in the public photo bucket, for a tour cover or
     * the homepage hero. The answer is the address to save with the tour or the settings.
     */
    public function image(Request $request, SubmissionPhotos $photos, StorageClient $storage): JsonResponse
    {
        $input = $request->validate([
            'photo' => ['required', 'string', 'max:2796204'],
            'kind' => ['required', Rule::in(['tour', 'hero'])],
        ]);
        $jpeg = $photos->sanitize($input['photo']);
        $path = 'site/'.$input['kind'].'-'.Str::uuid().'.jpg';
        try {
            $response = $storage->request()->withBody($jpeg, 'image/jpeg')->post('/object/'.PlacePhotos::BUCKET.'/'.$path);
        } catch (ConnectionException) {
            throw new ApiException(503, 'Photo upload failed. Please try again.');
        }
        if (! $response->successful()) {
            throw new ApiException(503, 'Photo upload failed. Please try again.');
        }
        $url = $storage->publicUrl(PlacePhotos::BUCKET, $path);
        $this->log->record('settings.image', 'Uploaded a '.($input['kind'] === 'hero' ? 'homepage' : 'tour').' image', 'image', null, ['url' => $url]);

        return response()->json(['url' => $url], 201);
    }
}
