<?php

namespace App\Http\Controllers;

use App\Http\Requests\NearbyPlacesRequest;
use App\Http\Requests\StorePlaceRequest;
use App\Http\Resources\PlaceResource;
use App\Repositories\PlaceRepository;
use App\Services\PlaceSearch;
use App\Services\Supabase\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PlaceController extends Controller
{
    public function __construct(private PlaceRepository $places) {}

    public function index(NearbyPlacesRequest $request, PlaceSearch $search): JsonResponse
    {
        $nearby = $request->validated();
        $places = $this->places->published();
        if ($nearby) {
            $places = $search->nearby($places, (float) $nearby['lat'], (float) $nearby['lng'], (float) ($nearby['radius'] ?? 50));
        }

        return response()->json(PlaceResource::collection($places)->resolve());
    }

    public function store(StorePlaceRequest $request, AuthService $auth): JsonResponse
    {
        return response()->json((new PlaceResource($this->places->create($request->validated(), $auth->token())))->resolve(), 201);
    }

    public function destroy(Request $request, AuthService $auth, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        validator(['id' => $id], ['id' => ['required', 'integer', 'min:1', 'max:9007199254740991']])->validate();
        $this->places->delete((int) $id, $auth->token());

        return response()->json(['success' => true]);
    }
}
