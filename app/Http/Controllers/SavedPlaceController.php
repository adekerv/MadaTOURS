<?php

namespace App\Http\Controllers;

use App\Http\Requests\SavedPlaceRequest;
use App\Http\Resources\PlaceResource;
use App\Repositories\SavedPlaceRepository;
use App\Services\Supabase\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SavedPlaceController extends Controller
{
    public function __construct(private SavedPlaceRepository $places, private AuthService $auth) {}

    public function index(Request $request, string $collection): JsonResponse
    {
        $items = $this->places->list($request->user()->getAuthIdentifier(), $collection, $this->auth->token());

        return response()->json(array_map(
            fn (array $item) => ! empty($item['unlisted']) ? ['id' => (int) $item['id'], 'unlisted' => true] : (new PlaceResource($item))->resolve(),
            $items,
        ));
    }

    public function store(SavedPlaceRequest $request, string $collection): JsonResponse
    {
        $input = $request->validated();
        $this->places->save($request->user()->getAuthIdentifier(), $collection, (int) $input['placeId'], $this->auth->token());

        return response()->json(['success' => true]);
    }

    public function destroy(SavedPlaceRequest $request, string $collection): JsonResponse
    {
        $input = $request->validated();
        $this->places->remove($request->user()->getAuthIdentifier(), $collection, (int) $input['placeId'], $this->auth->token());

        return response()->json(['success' => true]);
    }
}
