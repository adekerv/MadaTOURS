<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\TourRequest;
use App\Http\Resources\TourResource;
use App\Http\Resources\TourSummaryResource;
use App\Services\AdminLog;
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

    /** Published tours, featured ones first. */
    public function index(): JsonResponse
    {
        $rows = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'published' => 'eq.true', 'order' => 'featured.desc,id.asc']);

        return response()->json(TourSummaryResource::collection($rows)->resolve());
    }

    /** One published tour with its full road line, for the tour's own page. */
    public function show(string $id): JsonResponse
    {
        $rows = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'id' => 'eq.'.(int) $id, 'published' => 'eq.true', 'limit' => 1]);
        if (! $rows) {
            throw new ApiException(404, 'This tour could not be found.');
        }

        return response()->json((new TourResource($rows[0]))->resolve());
    }

    /** Every tour, drafts included, for the administrator who manages them. */
    public function manage(AuthService $auth): JsonResponse
    {
        Gate::authorize('manage-places');
        $rows = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'order' => 'id.asc'], $auth->token());

        return response()->json(TourSummaryResource::collection($rows)->resolve());
    }

    public function store(TourRequest $request, AuthService $auth, AdminLog $log): JsonResponse
    {
        Gate::authorize('manage-places');
        $columns = $request->columns();
        $this->routes->assertAllowed($columns['stops']);
        $row = $this->client->request('POST', '/rest/v1/mt_tours', $columns, $auth->token(), headers: ['Prefer' => 'return=representation'])[0];
        $log->record('tours.create', 'Created the tour “'.$row['name'].'”', 'tour', $row['id']);

        return response()->json((new TourResource($this->routes->refresh($row, $auth->token())))->resolve(), 201);
    }

    /**
     * Only changed places are checked, so a place removed later never blocks renaming or unpublishing a tour. Changed
     * stops lose the old road in the same write, so no visitor sees a line through removed stops.
     */
    public function update(TourRequest $request, AuthService $auth, AdminLog $log, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        $current = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => 'id,stops,route_stops_hash', 'id' => 'eq.'.(int) $id], $auth->token())[0] ?? null;
        if (! $current) {
            throw new ApiException(404, 'This tour could not be found.');
        }
        $columns = $request->columns();
        if (TourRoutes::fingerprint($columns['stops']) !== TourRoutes::fingerprint($current['stops'])) {
            $this->routes->assertAllowed($columns['stops']);
        }
        if (TourRoutes::fingerprint($columns['stops']) !== ($current['route_stops_hash'] ?? null)) {
            $columns += TourRoutes::cleared();
        }
        $row = $this->client->request('PATCH', '/rest/v1/mt_tours?id=eq.'.(int) $id, $columns, $auth->token(), headers: ['Prefer' => 'return=representation'])[0] ?? null;
        if (! $row) {
            throw new ApiException(404, 'This tour could not be found.');
        }
        $log->record('tours.update', 'Updated the tour “'.$row['name'].'”', 'tour', $row['id'], ['published' => $row['published'], 'featured' => $row['featured'] ?? false]);

        return response()->json((new TourResource($this->routes->refresh($row, $auth->token())))->resolve());
    }

    /** Asks for the road route again, for example after a key was added. */
    public function recalculate(AuthService $auth, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        $row = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'id' => 'eq.'.(int) $id], $auth->token())[0] ?? null;
        if (! $row) {
            throw new ApiException(404, 'This tour could not be found.');
        }

        return response()->json((new TourResource($this->routes->refresh($row, $auth->token(), force: true)))->resolve());
    }

    /**
     * A draft copy of a tour, road included: the stops are the same, so the stored route still fits them and no new
     * routing request is needed.
     */
    public function duplicate(AuthService $auth, AdminLog $log, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        $source = $this->client->request('GET', '/rest/v1/mt_tours', ['select' => '*', 'id' => 'eq.'.(int) $id], $auth->token())[0] ?? null;
        if (! $source) {
            throw new ApiException(404, 'This tour could not be found.');
        }
        $copy = array_intersect_key($source, array_flip(['name_fr', 'description', 'description_fr', 'stops', 'image', 'route_geojson', 'route_distance_m', 'route_duration_s', 'route_stops_hash', 'route_computed_at']));
        $copy['name'] = mb_substr($source['name'], 0, 112).' (copy)';
        $copy['published'] = false;
        $copy['featured'] = false;
        $row = $this->client->request('POST', '/rest/v1/mt_tours', $copy, $auth->token(), headers: ['Prefer' => 'return=representation'])[0];
        $log->record('tours.duplicate', 'Duplicated the tour “'.$source['name'].'”', 'tour', $row['id'], ['from' => $source['id']]);

        return response()->json((new TourSummaryResource($row))->resolve(), 201);
    }

    public function destroy(AuthService $auth, AdminLog $log, string $id): JsonResponse
    {
        Gate::authorize('manage-places');
        $rows = $this->client->request('DELETE', '/rest/v1/mt_tours?id=eq.'.(int) $id, token: $auth->token(), headers: ['Prefer' => 'return=representation']);
        if (! $rows) {
            throw new ApiException(404, 'This tour could not be found.');
        }
        $log->record('tours.delete', 'Deleted the tour “'.$rows[0]['name'].'”', 'tour', $id);

        return response()->json(['success' => true]);
    }
}
