<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\TourRequest;
use App\Http\Resources\TourResource;
use App\Services\Supabase\AuthService;
use App\Services\Supabase\SupabaseClient;
use App\Services\TourRoutes;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Tours: public to read once published, administrators only to write. Saving a tour never waits on routing to
 * succeed: the tour is stored first and the road route is attempted afterwards (see TourRoutes).
 */
class TourController extends Controller
{
    public function __construct(private SupabaseClient $client, private TourRoutes $routes) {}

    public function index(): JsonResponse
    {
        $rows = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'published' => 'eq.true', 'order' => 'id.asc']);

        return response()->json(TourResource::collection($rows)->resolve());
    }

    /** Every tour, drafts included, for the administrator who manages them. */
    public function manage(AuthService $auth): JsonResponse
    {
        Gate::authorize('manage-places');
        $rows = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'order' => 'id.asc'], $auth->token());

        return response()->json(TourResource::collection($rows)->resolve());
    }

    public function store(TourRequest $request, AuthService $auth): JsonResponse
    {
        Gate::authorize('manage-places');
        $row = $this->client->request('POST', '/rest/v1/mt_tours', $request->columns(), $auth->token(), headers: ['Prefer' => 'return=representation'])[0];

        return response()->json((new TourResource($this->routes->refresh($row, $auth->token())))->resolve(), 201);
    }

    public function update(TourRequest $request, AuthService $auth, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        $row = $this->client->request('PATCH', '/rest/v1/mt_tours?id=eq.'.$this->id($id), $request->columns(), $auth->token(), headers: ['Prefer' => 'return=representation'])[0] ?? null;
        if (! $row) {
            throw new ApiException(404, 'This tour could not be found.');
        }

        // Only changed stops ask for a new route; renaming or publishing a tour does not.
        return response()->json((new TourResource($this->routes->refresh($row, $auth->token())))->resolve());
    }

    /** Asks for the road route again, for example after a key was added. */
    public function recalculate(AuthService $auth, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        $row = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'id' => 'eq.'.$this->id($id)], $auth->token())[0] ?? null;
        if (! $row) {
            throw new ApiException(404, 'This tour could not be found.');
        }

        return response()->json((new TourResource($this->routes->refresh($row, $auth->token(), force: true)))->resolve());
    }

    public function destroy(AuthService $auth, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        $rows = $this->client->request('DELETE', '/rest/v1/mt_tours?id=eq.'.$this->id($id), token: $auth->token(), headers: ['Prefer' => 'return=representation']);
        if (! $rows) {
            throw new ApiException(404, 'This tour could not be found.');
        }

        return response()->json(['success' => true]);
    }

    private function id(string $id): int
    {
        validator(['id' => $id], ['id' => ['required', 'integer', 'min:1', 'max:9007199254740991']])->validate();

        return (int) $id;
    }
}
