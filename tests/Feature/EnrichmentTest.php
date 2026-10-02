<?php

namespace Tests\Feature;

use App\Services\Sources\GoogleMatcher;
use App\Services\Sources\PublicSourceClient;
use App\Services\Sources\RobotsPolicy;
use App\Services\Sources\SourceIngestion;
use App\Services\Sources\StructuredPlaceData;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class EnrichmentTest extends TestCase
{
    public function test_robots_longest_rule_specific_agent_and_encoded_paths(): void
    {
        $robots = new RobotsPolicy;
        $this->assertFalse($robots->allows("User-agent: *\nDisallow: /private\nAllow: /private/public$", '/private/secret'));
        $this->assertTrue($robots->allows("User-agent: *\nDisallow: /private\nAllow: /private/public$", '/private/public'));
        $this->assertFalse($robots->allows("User-agent: *\nDisallow: /private\nAllow: /private/public$", '/private/public/secret'));
        $this->assertTrue($robots->allows("User-agent: *\nDisallow: /\nUser-agent: MadaToursBot\nAllow: /venue", '/venue'));
        $this->assertFalse($robots->allows("User-agent: *\nDisallow: /private", '/%70rivate'));
    }

    public function test_source_extraction_requires_matching_name_and_handles_overnight_hours(): void
    {
        $parser = new StructuredPlaceData;
        $html = '<script type="application/ld+json">'.json_encode(['@graph' => [['name' => 'Other place', 'image' => 'https://example.org/wrong.jpg'], ['name' => 'Chez Émile', 'openingHoursSpecification' => ['dayOfWeek' => 'https://schema.org/Friday', 'opens' => '20:00', 'closes' => '01:00'], 'image' => ['contentUrl' => 'https://example.org/photo.jpg', 'license' => 'https://creativecommons.org/licenses/by/4.0/', 'creator' => 'Alice']]]]).'</script>';
        $data = $parser->extract($html, 'Chez Emile');
        $this->assertSame([['day' => 5, 'opens' => 1200, 'closes' => 1440], ['day' => 6, 'opens' => 0, 'closes' => 60]], $data['periods']);
        $this->assertSame('https://example.org/photo.jpg', $data['image']);
        $this->assertSame([], $parser->extract($html, 'Different venue'));
        $this->assertSame([], $parser->hours([['dayOfWeek' => 'Monday', 'opens' => '09:00', 'closes' => '18:00', 'validThrough' => '2020-01-01']]));
    }

    public function test_public_sources_reject_google_and_private_networks_before_requests(): void
    {
        $client = new class extends PublicSourceClient
        {
            public function addresses(string $host): array
            {
                return ['127.0.0.1'];
            }
        };
        foreach (['https://www.google.com/maps', 'https://maps.app.goo.gl/123', 'http://example.org', 'https://example.org:8000', 'https://user:pass@example.org', 'https://example.org'] as $url) {
            try {
                $client->validate($url);
                $this->fail('Unsafe source accepted');
            } catch (RuntimeException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_google_match_only_links_exact_nearby_unambiguous_venues_and_stores_no_content(): void
    {
        config(['enrichment.google_key' => 'private-test-key', 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public', 'supabase.secret_key' => 'secret']);
        Http::preventStrayRequests();
        $place = ['id' => 1, 'name' => 'Jardin de Balata', 'location' => 'Fort-de-France', 'lat' => 14.675, 'lng' => -61.025, 'google_place_id' => null];
        $candidate = ['id' => 'ChIJtest123456', 'displayName' => ['text' => 'Jardin de Balata'], 'location' => ['latitude' => 14.6751, 'longitude' => -61.025]];
        Http::fake(['*/mt_places*' => Http::response([$place]), '*/mt_google_matches*' => Http::response([]), 'https://places.googleapis.com/*' => Http::response(['places' => [$candidate]])]);
        $matcher = app(GoogleMatcher::class);
        $matcher->match(['place_id' => 1, 'attempts' => 0]);
        Http::assertSent(fn ($r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_places?') && $r['google_place_id'] === $candidate['id']);
        Http::assertSent(fn ($r) => str_contains($r->url(), '/mt_google_matches?') && $r['candidate_ids'] === [$candidate['id']] && ! isset($r['rating']) && ! isset($r['photos']) && ! isset($r['displayName']));
        $this->assertFalse($matcher->confident($place, array_replace($candidate, ['location' => ['latitude' => 14.9, 'longitude' => -61.025]])));
        $this->assertFalse($matcher->confident($place, array_replace($candidate, ['displayName' => ['text' => 'Jardin de Balata restaurant']])));
    }

    public function test_google_ambiguous_match_goes_to_review_and_does_not_publish(): void
    {
        config(['enrichment.google_key' => 'private-test-key', 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public', 'supabase.secret_key' => 'secret']);
        Http::preventStrayRequests();
        $place = ['id' => 2, 'name' => 'Restaurant test', 'location' => 'Martinique', 'lat' => 14.6, 'lng' => -61.0, 'google_place_id' => null];
        $candidate = ['id' => 'ChIJtest123456', 'displayName' => ['text' => 'Restaurant test'], 'location' => ['latitude' => 14.6, 'longitude' => -61.0]];
        Http::fake(['*/mt_places*' => Http::response([$place]), '*/mt_google_matches*' => Http::response([]), 'https://places.googleapis.com/*' => Http::response(['places' => [$candidate, array_replace($candidate, ['id' => 'ChIJother123456'])]])]);
        app(GoogleMatcher::class)->match(['place_id' => 2, 'attempts' => 0]);
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_places?'));
        Http::assertSent(fn ($r) => str_contains($r->url(), '/mt_google_matches?') && $r['status'] === 'review');
    }

    public function test_disallowed_source_is_logged_without_fetching_page(): void
    {
        config(['supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public', 'supabase.secret_key' => 'secret']);
        Http::preventStrayRequests();
        $http = new class extends PublicSourceClient
        {
            public function addresses(string $host): array
            {
                return ['93.184.215.14'];
            }
        };
        Http::fake(['https://example.org/robots.txt' => Http::response("User-agent: *\nDisallow: /", 200), 'https://project.supabase.co/*' => Http::response([])]);
        (new SourceIngestion(app(SupabaseClient::class), $http, new RobotsPolicy, new StructuredPlaceData))->ingest(['place_id' => 1, 'url' => 'https://example.org/venue']);
        Http::assertNotSent(fn ($r) => $r->url() === 'https://example.org/venue');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/mt_source_logs') && $r['status'] === 'robots_denied');
    }

    public function test_official_hours_update_but_photo_requires_moderation(): void
    {
        config(['supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public', 'supabase.secret_key' => 'secret']);
        Http::preventStrayRequests();
        $http = new class extends PublicSourceClient
        {
            public function addresses(string $host): array { return ['93.184.215.14']; }
        };
        $html = '<script type="application/ld+json">'.json_encode(['@type' => 'Restaurant', 'name' => 'Chez Camille', 'openingHoursSpecification' => ['dayOfWeek' => 'Monday', 'opens' => '09:00', 'closes' => '17:00'], 'image' => ['contentUrl' => 'https://example.org/photo.jpg', 'creator' => 'Camille', 'license' => 'https://creativecommons.org/licenses/by/4.0/']]).'</script>';
        Http::fake([
            'https://example.org/robots.txt' => Http::response('', 404),
            'https://example.org/venue' => Http::response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']),
            '*/mt_places*' => Http::response([['name' => 'Chez Camille']]),
            'https://project.supabase.co/*' => Http::response([]),
        ]);
        (new SourceIngestion(app(SupabaseClient::class), $http, new RobotsPolicy, new StructuredPlaceData))->ingest(['place_id' => 1, 'url' => 'https://example.org/venue']);
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/rpc/mt_apply_source_hours') && $r['periods'] === [['day' => 1, 'opens' => 540, 'closes' => 1020]]);
        Http::assertSent(fn ($r) => str_contains($r->url(), '/mt_source_settings?') && $r['candidate_photo']['author'] === 'Camille');
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_places?'));
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/mt_source_logs') && $r['hours_updated'] && $r['photo_found']);
    }

    public function test_unavailable_robots_is_not_treated_as_permission(): void
    {
        config(['supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public', 'supabase.secret_key' => 'secret']);
        Http::preventStrayRequests();
        $http = new class extends PublicSourceClient
        {
            public function addresses(string $host): array { return ['93.184.215.14']; }
        };
        Http::fake(['https://example.org/robots.txt' => Http::response('', 503), 'https://project.supabase.co/*' => Http::response([])]);
        (new SourceIngestion(app(SupabaseClient::class), $http, new RobotsPolicy, new StructuredPlaceData))->ingest(['place_id' => 1, 'url' => 'https://example.org/venue']);
        Http::assertNotSent(fn ($r) => $r->url() === 'https://example.org/venue');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/mt_source_logs') && $r['status'] === 'robots_denied');
    }
}
