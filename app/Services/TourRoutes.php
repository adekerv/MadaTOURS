<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Support\Collection;
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
     * The route columns of a tour that has no road line, written in the same step as new stops so a changed tour
     * never keeps the line of its old stops.
     *
     * @return array<string, null>
     */
    public static function cleared(): array
    {
        return ['route_geojson' => null, 'route_distance_m' => null, 'route_duration_s' => null, 'route_stops_hash' => null, 'route_computed_at' => null];
    }

    /**
     * Every stop must be a listed place that visitors may go to, like the places in a day plan.
     *
     * @throws ApiException
     */
    public function assertAllowed(array $stops): void
    {
        $places = $this->places($stops);
        foreach ($stops as $stop) {
            $place = $places->get((int) $stop['placeId']);
            if (! $place) {
                throw new ApiException(422, 'Every stop must be a place that is listed.');
            }
            if (($place['access'] ?? 'unknown') === 'restricted') {
                throw new ApiException(422, 'Places with restricted access cannot be part of a tour.');
            }
        }
    }

    /**
     * Requests the road route once for the tour's current stops and stores it. A tour that already has the road for
     * these stops is left alone unless forced, which keeps the free plan's quota for real changes. This never
     * throws, so a routing problem can never stop a tour from being saved: the tour then has no road line and the
     * map draws straight ones. If routing fails for stops whose road is already stored, that road is kept.
     *
     * @param  string|null  $token  The administrator's token; without one the server's own key is used (for the command)
     * @return array<string, mixed> The tour, with its route fields as stored
     */
    public function refresh(array $tour, ?string $token = null, bool $force = false): array
    {
        $hash = self::fingerprint($tour['stops']);
        $current = ($tour['route_stops_hash'] ?? null) === $hash && ! empty($tour['route_geojson']);
        if ($current && ! $force) {
            return $tour;
        }
        $road = $this->drive($tour);
        if ($road === null && $current) {
            return $tour;
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

    /** @return array{coordinates: list<array{0: float, 1: float}>, distance: int, duration: int}|null */
    private function drive(array $tour): ?array
    {
        try {
            $places = $this->places($tour['stops']);
            $coordinates = [];
            foreach ($tour['stops'] as $stop) {
                $place = $places->get((int) $stop['placeId']);
                if (! $place) {
                    Log::warning('Road route not available, so straight lines are used: a stop is not a listed place', ['tour' => $tour['id']]);

                    return null;
                }
                $coordinates[] = [(float) $place['lng'], (float) $place['lat']];
            }

            return $this->roads->drive($coordinates, ['tour' => $tour['id']]);
        } catch (\Throwable) {
            Log::warning('Road route not available, so straight lines are used: the places could not be read', ['tour' => $tour['id']]);

            return null;
        }
    }

    /** @return Collection<int, array<string, mixed>> The listed places among the stops, by id */
    private function places(array $stops): Collection
    {
        $ids = array_map(fn ($stop) => (int) $stop['placeId'], $stops);
        $rows = $this->client->request('GET', '/rest/v1/mt_places', ['select' => 'id,lat,lng,access', 'id' => 'in.('.implode(',', $ids).')', 'published' => 'eq.true']);

        return collect($rows)->keyBy(fn ($row) => (int) $row['id']);
    }
}
