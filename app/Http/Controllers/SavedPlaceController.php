<?php

namespace App\Http\Controllers;

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
        return response()->json(PlaceResource::collection($this->places->list($request->attributes->get('account')['id'], $collection, $this->auth->token()))->resolve());
    }
    public function store(Request $request, string $collection): JsonResponse
    {
        $input = $request->validate(['placeId' => ['required', 'integer', 'min:1', 'max:9007199254740991']]);
        $this->places->save($request->attributes->get('account')['id'], $collection, (int) $input['placeId'], $this->auth->token());
        return response()->json(['success' => true]);
    }
    public function destroy(Request $request, string $collection): JsonResponse
    {
        $input = $request->validate(['placeId' => ['required', 'integer', 'min:1', 'max:9007199254740991']]);
        $this->places->remove($request->attributes->get('account')['id'], $collection, (int) $input['placeId'], $this->auth->token());
        return response()->json(['success' => true]);
    }
}
