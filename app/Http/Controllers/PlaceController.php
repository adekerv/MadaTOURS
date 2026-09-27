<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\StorePlaceRequest;
use App\Http\Resources\PlaceResource;
use App\Repositories\PlaceRepository;
use App\Services\Supabase\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaceController extends Controller
{
    public function __construct(private PlaceRepository $places) {}

    public function index(Request $request): JsonResponse
    {
        $nearby = $request->hasAny(['lat', 'lng', 'radius']) ? $request->validate(['lat' => ['required', 'numeric', 'between:-90,90'], 'lng' => ['required', 'numeric', 'between:-180,180'], 'radius' => ['sometimes', 'required', 'numeric', 'between:1,100']]) : null;
        $places = $this->places->published();
        if ($nearby) {
            foreach ($places as &$place) {
                $a = sin(deg2rad($place['lat'] - $nearby['lat']) / 2) ** 2 + cos(deg2rad($nearby['lat'])) * cos(deg2rad($place['lat'])) * sin(deg2rad($place['lng'] - $nearby['lng']) / 2) ** 2;
                $place['distance'] = 6371 * 2 * atan2(sqrt(min(1, $a)), sqrt(max(0, 1 - $a)));
            }
            unset($place);
            $places = array_values(array_filter($places, fn ($p) => $p['distance'] <= ($nearby['radius'] ?? 50)));
            usort($places, fn ($a, $b) => $a['distance'] <=> $b['distance']);
        }
        return response()->json(PlaceResource::collection($places)->resolve());
    }

    public function store(StorePlaceRequest $request, AuthService $auth): JsonResponse
    {
        return response()->json((new PlaceResource($this->places->create($request->validated(), $auth->token())))->resolve(), 201);
    }

    public function destroy(Request $request, AuthService $auth, string $id): JsonResponse
    {
        if ($request->attributes->get('account')['role'] !== 'admin') throw new ApiException(403, 'Only administrators can manage places.');
        validator(['id' => $id], ['id' => ['required', 'integer', 'min:1', 'max:9007199254740991']])->validate();
        $this->places->delete((int) $id, $auth->token());
        return response()->json(['success' => true]);
    }
}
