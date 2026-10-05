<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PlaceListTest extends TestCase
{
    private function row(array $changes = []): array
    {
        return array_replace([
            'id' => 5, 'name' => 'Chez Camille', 'type' => 'restaurant', 'lat' => 14.6, 'lng' => -61.0, 'location' => 'Le Carbet',
            'description' => 'A beach restaurant.', 'description_fr' => 'Un restaurant de plage.', 'tags' => ['Seafood'], 'published' => true,
            'details' => ['phone' => '+596 596 11 22 33', 'address' => '1 Rue Test'],
            'sources' => [['url' => 'https://example.test/a', 'title' => 'Source', 'checkedAt' => '2026-10-02', 'fields' => ['phone']]],
            'opening_periods' => [['day' => 1, 'opens' => 540, 'closes' => 1020]],
        ], $changes);
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key']);
        Http::preventStrayRequests();
    }

    public function test_the_list_leaves_out_the_heavy_fields_and_keeps_what_the_map_and_lists_need(): void
    {
        Http::fake(['*/mt_places*' => Http::response([$this->row()])]);
        $place = $this->getJson('/api/places')->assertOk()->assertJsonCount(1)->json('0');

        $this->assertArrayNotHasKey('details', $place);
        $this->assertArrayNotHasKey('sources', $place);
        $this->assertSame('Chez Camille', $place['name']);
        $this->assertSame('A beach restaurant.', $place['description']);
        $this->assertSame('Un restaurant de plage.', $place['descriptionFr']);
        $this->assertSame([['day' => 1, 'opens' => 540, 'closes' => 1020]], $place['openingPeriods']);
    }

    public function test_the_list_asks_the_database_only_for_the_columns_it_shows(): void
    {
        Http::fake(['*/mt_places*' => Http::response([$this->row()])]);
        $this->getJson('/api/places')->assertOk();
        $asked = [];
        Http::assertSent(function ($request) use (&$asked) {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
            $asked = explode(',', $query['select'] ?? '');

            return true;
        });
        // Every column the full place reads, apart from the two the list drops, must be in the list's query.
        preg_match_all('/\$p\[\'([a-z_]+)\'\]/', file_get_contents(app_path('Http/Resources/PlaceResource.php')), $read);
        $needed = array_diff(array_unique($read[1]), ['details', 'sources', 'distance']);
        $this->assertSame([], array_values(array_diff($needed, $asked)));
        $this->assertNotContains('details', $asked);
        $this->assertNotContains('sources', $asked);
        Http::fake(['*/mt_places*' => Http::response([$this->row()])]);
        $this->getJson('/api/places?full=1')->assertOk();
        Http::assertSent(fn ($r) => str_contains($r->url(), 'select=%2A') || str_contains($r->url(), 'select=*'));
    }

    public function test_the_full_list_is_still_available_for_the_admin_panel(): void
    {
        Http::fake(['*/mt_places*' => Http::response([$this->row()])]);
        $place = $this->getJson('/api/places?full=1')->assertOk()->json('0');

        $this->assertSame('+596 596 11 22 33', $place['details']['phone']);
        $this->assertCount(1, $place['sources']);
    }

    public function test_one_place_comes_with_everything(): void
    {
        Http::fake(['*/mt_places*' => Http::response([$this->row()])]);
        $this->getJson('/api/places/5')->assertOk()->assertJsonPath('details.address', '1 Rue Test')->assertJsonPath('sources.0.title', 'Source');
        Http::assertSent(fn ($r) => str_contains($r->url(), 'id=eq.5') && str_contains($r->url(), 'published=eq.true') && $r->header('Authorization') === []);
    }

    public function test_an_unknown_hidden_or_malformed_place_is_not_found(): void
    {
        Http::fake(['*/mt_places*' => Http::response([])]);
        $this->getJson('/api/places/999')->assertNotFound()->assertJsonPath('error', 'This place could not be found.');
        // The numeric constraint keeps this away from the controller (the DELETE route shares the path, hence 405).
        $this->getJson('/api/places/not-a-number')->assertClientError();
        $this->getJson('/api/places/0')->assertNotFound();
        Http::assertSentCount(2);
    }
}
