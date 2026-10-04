<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Road routes from OpenRouteService (free plan, key in ORS_API_KEY). It never throws: a missing key, a refusal or an
 * outage all return null, and the caller keeps drawing straight lines. The key is never logged.
 */
class OpenRouteService
{
    /** The service accepts at most 50 waypoints in one request. */
    public const MAX_WAYPOINTS = 50;

    public function configured(): bool
    {
        return filled(config('services.openrouteservice.key'));
    }

    /**
     * @param  list<array{0: float, 1: float}>  $coordinates  [longitude, latitude] of each stop, in visiting order
     * @param  array<string, mixed>  $context  Where the request came from, for the log
     * @return array{coordinates: list<array{0: float, 1: float}>, distance: int, duration: int}|null
     */
    public function drive(array $coordinates, array $context = []): ?array
    {
        if (! $this->configured()) {
            return $this->skip('ORS_API_KEY is not set', $context);
        }
        if (count($coordinates) < 2 || count($coordinates) > self::MAX_WAYPOINTS) {
            return $this->skip('a route needs between 2 and '.self::MAX_WAYPOINTS.' stops', $context);
        }
        try {
            $response = Http::baseUrl(config('services.openrouteservice.url'))
                ->withHeaders(['Authorization' => config('services.openrouteservice.key')])
                ->acceptJson()->asJson()->connectTimeout(5)->timeout(config('services.openrouteservice.timeout'))
                ->post('/v2/directions/driving-car/geojson', [
                    'coordinates' => $coordinates,
                    'instructions' => false,
                    // A stop a little off the road still gets routed, to the nearest road, instead of failing.
                    'radiuses' => array_fill(0, count($coordinates), -1),
                ]);
        } catch (\Throwable) {
            return $this->skip('the service could not be reached', $context);
        }
        if (! $response->successful()) {
            return $this->skip('the service answered '.$response->status().' '.($response->json('error.code') ?? ''), $context);
        }

        return $this->parse($response->json(), $context);
    }

    private function parse(mixed $body, array $context): ?array
    {
        $feature = is_array($body) ? ($body['features'][0] ?? null) : null;
        $line = $feature['geometry']['coordinates'] ?? null;
        $summary = $feature['properties']['summary'] ?? null;
        if (($feature['geometry']['type'] ?? null) !== 'LineString' || ! is_array($line) || count($line) < 2
            || ! is_numeric($summary['distance'] ?? null) || ! is_numeric($summary['duration'] ?? null)) {
            return $this->skip('the answer was not a route', $context);
        }
        // Five decimals is about a metre, which keeps the stored line small without changing how it looks.
        $points = [];
        foreach ($line as $point) {
            $rounded = [round((float) $point[0], 5), round((float) $point[1], 5)];
            if ($rounded !== end($points)) {
                $points[] = $rounded;
            }
        }
        if (count($points) < 2) {
            return $this->skip('the route had no length', $context);
        }

        return ['coordinates' => $points, 'distance' => (int) round($summary['distance']), 'duration' => (int) round($summary['duration'])];
    }

    private function skip(string $reason, array $context): null
    {
        Log::warning('Road route not available, so straight lines are used: '.$reason, $context);

        return null;
    }
}
