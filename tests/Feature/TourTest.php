<?php

namespace Tests\Feature;

use App\Services\TourRoutes;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class TourTest extends TestCase
{
    private const STOPS = [['placeId' => 1, 'minutes' => 60], ['placeId' => 2, 'minutes' => 45]];

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'app.url' => 'https://madatours.test', 'supabase.app_origin' => 'https://madatours.test',
            'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key',
            'services.openrouteservice.url' => 'https://ors.test', 'services.openrouteservice.key' => 'ors-key', 'services.openrouteservice.delay_ms' => 0,
        ]);
        Http::preventStrayRequests();
    }

    private function row(array $changes = []): array
    {
        return array_replace([
            'id' => 7, 'name' => 'South coast', 'name_fr' => null, 'description' => 'Beaches and a lighthouse.', 'description_fr' => null,
            'published' => true, 'stops' => self::STOPS, 'route_geojson' => null, 'route_distance_m' => null, 'route_duration_s' => null,
            'route_stops_hash' => null, 'route_computed_at' => null, 'updated_at' => '2026-10-04T10:00:00Z',
        ], $changes);
    }

    private function road(): array
    {
        return ['features' => [['geometry' => ['type' => 'LineString', 'coordinates' => [[-61.0, 14.6], [-61.05, 14.62], [-61.1, 14.7]]], 'properties' => ['summary' => ['distance' => 1234.6, 'duration' => 601.2]]]]];
    }

    /** Supabase answers for an administrator; $tours is what the tours table returns (the request's own fields are merged in on writes). */
    private function fake(array $tours, mixed $routing = null, string $role = 'admin'): void
    {
        Http::fake([
            '*/auth/v1/user' => Http::response(['id' => 'admin', 'email' => 'admin@example.com']),
            '*/mt_profiles*' => Http::response([['role' => $role]]),
            '*/mt_places*' => Http::response([['id' => 1, 'lat' => 14.6, 'lng' => -61.0], ['id' => 2, 'lat' => 14.7, 'lng' => -61.1]]),
            '*/mt_tours*' => fn ($request) => Http::response($request->method() === 'GET' ? $tours : [array_replace($tours[0], $request->data())]),
            'https://ors.test/*' => $routing ?? Http::response($this->road()),
        ]);
    }

    private function admin()
    {
        return $this->withSession(['supabase' => ['access_token' => 'admin-token', 'refresh_token' => 'refresh', 'expires_at' => time() + 3600]])->withHeader('X-MadaTours-Client', '1');
    }

    private function payload(array $changes = []): array
    {
        return array_replace(['name' => 'South coast', 'description' => 'Beaches and a lighthouse.', 'published' => true, 'stops' => self::STOPS], $changes);
    }

    private function routingRequests(): int
    {
        return Http::recorded(fn ($request) => str_starts_with($request->url(), 'https://ors.test/'))->count();
    }

    public function test_saving_a_tour_asks_for_the_road_route_once_and_stores_it(): void
    {
        $this->fake([$this->row()]);
        $response = $this->admin()->postJson('/api/tours', $this->payload())->assertCreated();

        $this->assertSame(1, $this->routingRequests());
        Http::assertSent(fn ($r) => $r->url() === 'https://ors.test/v2/directions/driving-car/geojson'
            && $r->header('Authorization')[0] === 'ors-key'
            // OpenRouteService wants longitude first.
            && $r['coordinates'] === [[-61.0, 14.6], [-61.1, 14.7]]
            && $r['instructions'] === false);
        Http::assertSent(fn ($r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_tours?id=eq.7')
            && $r['route_geojson']['type'] === 'LineString' && count($r['route_geojson']['coordinates']) === 3
            && $r['route_distance_m'] === 1235 && $r['route_duration_s'] === 601
            && $r['route_stops_hash'] === TourRoutes::fingerprint(self::STOPS));
        $response->assertJsonPath('routeSource', 'road')->assertJsonPath('route.distanceM', 1235)->assertJsonPath('route.geometry.type', 'LineString');
    }

    public function test_a_missing_key_never_blocks_saving_and_is_logged_without_the_key(): void
    {
        config(['services.openrouteservice.key' => null]);
        Log::spy();
        $this->fake([$this->row()]);
        $this->admin()->postJson('/api/tours', $this->payload())->assertCreated()->assertJsonPath('routeSource', 'straight')->assertJsonPath('route', null);

        $this->assertSame(0, $this->routingRequests());
        Log::shouldHaveReceived('warning')->withArgs(fn ($message) => str_contains($message, 'ORS_API_KEY is not set'))->once();
        // The tour is marked as not routed, so the next save tries again once a key exists.
        Http::assertSent(fn ($r) => $r->method() === 'PATCH' && $r['route_geojson'] === null && $r['route_stops_hash'] === null);
    }

    public function test_a_routing_failure_never_blocks_saving(): void
    {
        Log::spy();
        $this->fake([$this->row()], Http::response(['error' => ['code' => 2010]], 403));
        $this->admin()->postJson('/api/tours', $this->payload())->assertCreated()->assertJsonPath('routeSource', 'straight');
        Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context = []) => str_contains($message, 'answered 403') && ! str_contains($message.json_encode($context), 'ors-key'))->once();
    }

    public function test_an_unreachable_service_or_a_malformed_answer_leaves_straight_lines(): void
    {
        $this->fake([$this->row()], fn () => throw new ConnectionException('timed out'));
        $this->admin()->postJson('/api/tours', $this->payload())->assertCreated()->assertJsonPath('routeSource', 'straight');

        $this->fake([$this->row()], Http::response(['features' => []]));
        $this->admin()->postJson('/api/tours', $this->payload())->assertCreated()->assertJsonPath('routeSource', 'straight');
    }

    public function test_a_failure_to_store_the_route_still_returns_the_saved_tour(): void
    {
        Http::fake([
            '*/auth/v1/user' => Http::response(['id' => 'admin', 'email' => 'admin@example.com']),
            '*/mt_profiles*' => Http::response([['role' => 'admin']]),
            '*/mt_places*' => Http::response([['id' => 1, 'lat' => 14.6, 'lng' => -61.0], ['id' => 2, 'lat' => 14.7, 'lng' => -61.1]]),
            '*/mt_tours*' => fn ($request) => $request->method() === 'POST' ? Http::response([$this->row()]) : Http::response(['code' => '42501'], 403),
            'https://ors.test/*' => Http::response($this->road()),
        ]);
        $this->admin()->postJson('/api/tours', $this->payload())->assertCreated()->assertJsonPath('id', 7)->assertJsonPath('routeSource', 'straight');
    }

    public function test_editing_without_changing_the_stops_does_not_use_the_quota(): void
    {
        $routed = $this->row(['route_geojson' => ['type' => 'LineString', 'coordinates' => [[-61.0, 14.6], [-61.1, 14.7]]], 'route_stops_hash' => TourRoutes::fingerprint(self::STOPS)]);
        $this->fake([$routed]);
        $this->admin()->postJson('/api/tours/7', $this->payload(['name' => 'Renamed tour']))->assertOk()->assertJsonPath('name', 'Renamed tour')->assertJsonPath('routeSource', 'road');
        $this->assertSame(0, $this->routingRequests());
        // The stored route is never taken from what the browser sends.
        $this->admin()->postJson('/api/tours/7', $this->payload(['route_geojson' => ['type' => 'LineString', 'coordinates' => [[0, 0], [1, 1]]]]))->assertOk();
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH' && isset($r['route_geojson']) && $r['route_geojson']['coordinates'] === [[0, 0], [1, 1]]);
    }

    public function test_changing_the_stops_asks_for_a_new_route(): void
    {
        $changed = [['placeId' => 2, 'minutes' => 30], ['placeId' => 1, 'minutes' => 30]];
        $this->fake([$this->row(['route_geojson' => ['type' => 'LineString', 'coordinates' => [[-61.0, 14.6], [-61.1, 14.7]]], 'route_stops_hash' => TourRoutes::fingerprint(self::STOPS)])]);
        $this->admin()->postJson('/api/tours/7', $this->payload(['stops' => $changed]))->assertOk();
        $this->assertSame(1, $this->routingRequests());
        Http::assertSent(fn ($r) => str_starts_with($r->url(), 'https://ors.test/') && $r['coordinates'] === [[-61.1, 14.7], [-61.0, 14.6]]);
    }

    public function test_only_the_visiting_order_matters_to_the_fingerprint(): void
    {
        $this->assertSame(TourRoutes::fingerprint([['placeId' => 1, 'minutes' => 10], ['placeId' => 2, 'minutes' => 20]]), TourRoutes::fingerprint([['placeId' => 1, 'minutes' => 90], ['placeId' => 2, 'minutes' => 5]]));
        $this->assertNotSame(TourRoutes::fingerprint(self::STOPS), TourRoutes::fingerprint(array_reverse(self::STOPS)));
    }

    public function test_recalculating_forces_a_new_request(): void
    {
        $this->fake([$this->row(['route_geojson' => ['type' => 'LineString', 'coordinates' => [[-61.0, 14.6], [-61.1, 14.7]]], 'route_stops_hash' => TourRoutes::fingerprint(self::STOPS)])]);
        $this->admin()->postJson('/api/tours/7/route')->assertOk()->assertJsonPath('routeSource', 'road');
        $this->assertSame(1, $this->routingRequests());
    }

    public function test_only_administrators_can_change_tours(): void
    {
        $this->fake([$this->row()], role: 'user');
        $this->admin()->postJson('/api/tours', $this->payload())->assertForbidden();
        $this->admin()->postJson('/api/tours/7', $this->payload())->assertForbidden();
        $this->admin()->postJson('/api/tours/7/route')->assertForbidden();
        $this->admin()->deleteJson('/api/tours/7')->assertForbidden();
        $this->admin()->getJson('/api/moderation/tours')->assertForbidden();
        $this->assertSame(0, $this->routingRequests());
        Http::assertNotSent(fn ($r) => str_contains($r->url(), '/mt_tours'));
    }

    public function test_guests_cannot_change_tours(): void
    {
        $this->withHeader('X-MadaTours-Client', '1')->postJson('/api/tours', $this->payload())->assertUnauthorized();
        $this->withHeader('X-MadaTours-Client', '1')->deleteJson('/api/tours/7')->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_a_tour_needs_two_distinct_stops(): void
    {
        $this->fake([$this->row()]);
        $this->admin()->postJson('/api/tours', $this->payload(['stops' => [['placeId' => 1, 'minutes' => 60]]]))->assertStatus(400)->assertJsonPath('error', 'Choose at least two stops.');
        $this->admin()->postJson('/api/tours', $this->payload(['stops' => [['placeId' => 1, 'minutes' => 60], ['placeId' => 1, 'minutes' => 30]]]))->assertStatus(400)->assertJsonPath('error', 'A place can appear once in a tour.');
        $this->admin()->postJson('/api/tours', $this->payload(['stops' => [['placeId' => 1, 'minutes' => 2], ['placeId' => 2, 'minutes' => 30]]]))->assertStatus(400)->assertJsonPath('error', 'A visit lasts between 5 and 720 minutes.');
        $this->admin()->postJson('/api/tours', $this->payload(['name' => '<b>x</b>']))->assertStatus(400);
        Http::assertNotSent(fn ($r) => str_contains($r->url(), '/mt_tours'));
    }

    public function test_the_public_list_shows_published_tours_with_their_stored_road_line(): void
    {
        $routed = $this->row(['route_geojson' => ['type' => 'LineString', 'coordinates' => [[-61.0, 14.6], [-61.1, 14.7]]], 'route_distance_m' => 9000, 'route_duration_s' => 800, 'route_stops_hash' => 'x']);
        $this->fake([$routed, $this->row(['id' => 8])]);
        $list = $this->getJson('/api/tours')->assertOk();
        $this->assertEquals([[-61.0, 14.6], [-61.1, 14.7]], $list->json('0.route.geometry.coordinates'));
        $list->assertJsonPath('0.routeSource', 'road')->assertJsonPath('1.routeSource', 'straight')->assertJsonPath('1.route', null);
        $this->assertArrayNotHasKey('route_stops_hash', $list->json('0'));
        Http::assertSent(fn ($r) => str_contains($r->url(), '/mt_tours') && $r['published'] === 'eq.true' && $r->header('Authorization') === []);
        $this->assertSame(0, $this->routingRequests());
    }

    public function test_the_command_works_out_routes_for_tours_without_one(): void
    {
        $routed = $this->row(['id' => 1, 'route_geojson' => ['type' => 'LineString', 'coordinates' => [[-61.0, 14.6], [-61.1, 14.7]]]]);
        $this->fake([$routed, $this->row(['id' => 2, 'name' => 'North loop']), $this->row(['id' => 3, 'name' => 'Inland'])]);
        $this->artisan('tours:compute-routes')->expectsOutputToContain('Tour 2 (North loop): road route stored')->expectsOutputToContain('2 road route(s) stored')->assertSuccessful();
        $this->assertSame(2, $this->routingRequests());
        Http::assertSent(fn ($r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_tours?id=eq.2') && $r->header('apikey')[0] === 'private-key');
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_tours?id=eq.1'));
    }

    public function test_the_command_can_redo_every_tour_and_reports_failures(): void
    {
        $this->fake([$this->row(['id' => 1, 'route_geojson' => ['type' => 'LineString', 'coordinates' => [[-61.0, 14.6], [-61.1, 14.7]]]]), $this->row(['id' => 2])], Http::response('', 500));
        $this->artisan('tours:compute-routes', ['--all' => true])->expectsOutputToContain('no road route, so straight lines are used')->expectsOutputToContain('0 road route(s) stored, 2 tour(s) left with straight lines')->assertSuccessful();
        $this->assertSame(2, $this->routingRequests());
    }

    public function test_the_command_stops_early_without_a_key(): void
    {
        config(['services.openrouteservice.key' => '']);
        Http::fake();
        $this->artisan('tours:compute-routes')->expectsOutputToContain('ORS_API_KEY is not set')->assertFailed();
        Http::assertNothingSent();
    }
}
