<?php

namespace App\Services;

use App\Services\Supabase\SupabaseClient;
use Illuminate\Support\Facades\Log;

/** Works out a tour's road route when its stops change and stores it on the tour. */
class TourRoutes
{
    public function __construct(private SupabaseClient $client, private OpenRouteService $roads) {}

    /** What the stored route was worked out for: the places in order. Visit times do not change the roads. */
    public static function fingerprint(array $stops): string
    {
        return hash('sha256', 'driving-car:'.implode(',', array_map(fn ($stop) => (int) $stop['placeId'], $stops)));
    }

    /**
     * Requests the road route once for the tour's current stops and stores it. Stops that already have their
     * road line are left alone unless forced, which keeps the free plan's quota for real changes. This never throws, so a routing problem can
     * never stop a tour from being saved: the tour then has no road line and the map draws straight ones.
     *
     * @param  string|null  $token  The administrator's token; without one the server's own key is used (for the command)
     * @return array<string, mixed> The tour, with its route fields as stored
     */
    public function refresh(array $tour, ?string $token = null, bool $force = false): array
    {
        $hash = self::fingerprint($tour['stops']);
        // A tour without a road line asks again, so adding the key later and saving once is enough.
        if (! $force && ($tour['route_stops_hash'] ?? null) === $hash && ! empty($tour['route_geojson'])) {
            return $tour;
        }
        $road = null;
        try {
            $coordinates = $this->coordinates($tour['stops']);
            $road = $coordinates ? $this->roads->drive($coordinates, ['tour' => $tour['id']]) : null;
            if (! $coordinates) {
                Log::warning('Road route not available, so straight lines are used: a stop is not a published place', ['tour' => $tour['id']]);
            }
        } catch (\Throwable) {
            Log::warning('Road route not available, so straight lines are used: the places could not be read', ['tour' => $tour['id']]);
        }
        $fields = [
            'route_geojson' => $road ? ['type' => 'LineString', 'coordinates' => $road['coordinates']] : null,
            'route_distance_m' => $road['distance'] ?? null,
            'route_duration_s' => $road['duration'] ?? null,
            'route_stops_hash' => $road ? $hash : null,
            'route_computed_at' => now()->toIso8601String(),
        ];
        try {
            $this->client->request('PATCH', '/rest/v1/mt_tours?id=eq.'.(int) $tour['id'], $fields, $token, admin: $token === null);
        } catch (\Throwable) {
            Log::warning('A tour\'s route could not be stored', ['tour' => $tour['id']]);

            return $tour;
        }

        return $fields + $tour;
    }

    /** @return list<array{0: float, 1: float}>|null [longitude, latitude] per stop, or null if a stop cannot be found */
    private function coordinates(array $stops): ?array
    {
        $ids = array_map(fn ($stop) => (int) $stop['placeId'], $stops);
        $rows = $this->client->request('GET', '/rest/v1/mt_places', ['select' => 'id,lat,lng', 'id' => 'in.('.implode(',', $ids).')', 'published' => 'eq.true']);
        $byId = collect($rows)->keyBy('id');
        $coordinates = [];
        foreach ($ids as $id) {
            if (! $byId->has($id)) {
                return null;
            }
            $coordinates[] = [(float) $byId[$id]['lng'], (float) $byId[$id]['lat']];
        }

        return $coordinates;
    }
}
