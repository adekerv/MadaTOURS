<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ApiTest extends TestCase
{
    public function test_public_shell_does_not_replace_the_api_session_cookie(): void
    {
        $this->withoutVite()->get('/')->assertOk()->assertCookieMissing('madatours-session');
        Http::fake([
            '*/mt_places*' => Http::response([]),
            '*/mt_metadata*' => Http::response([['value' => '1']]),
        ]);
        $this->getJson('/api/places')->assertOk()->assertCookieMissing('madatours-session');
        $this->getJson('/api/health')->assertOk()->assertCookieMissing('madatours-session');
    }

    public function test_guests_receive_json_without_an_accept_header(): void
    {
        $this->get('/api/favorites')->assertUnauthorized()->assertExactJson(['error' => 'Please sign in to continue.']);
        Http::assertNothingSent();
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'app.url' => 'https://madatours.test', 'supabase.app_origin' => 'https://madatours.test', 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
    }

    public function test_origin_and_custom_header_checks_run_before_provider_calls(): void
    {
        $this->withHeaders(['Origin' => 'https://attacker.test', 'X-MadaTours-Client' => '1'])->postJson('/api/auth/login', [])->assertForbidden();
        $this->withHeaders(['Origin' => 'https://madatours.test', 'X-MadaTours-Client' => ''])->postJson('/api/auth/login', [])->assertForbidden();
        $this->withHeaders(['Origin' => 'https://madatours.test', 'X-MadaTours-Client' => '1'])->postJson('/api/auth/login', [])->assertStatus(400)->assertHeader('Access-Control-Allow-Origin', 'https://madatours.test');
        Http::assertNothingSent();
    }

    public function test_native_preflight_is_allowed_but_similar_domains_are_not(): void
    {
        $this->withHeader('Origin', 'capacitor://localhost')->options('/api/auth/login')->assertNoContent()->assertHeader('Access-Control-Allow-Credentials', 'true');
        $this->withHeader('Origin', 'https://madatours.test.attacker.test')->options('/api/auth/login')->assertForbidden();
    }

    public function test_guests_cannot_read_saved_places_or_delete_accounts(): void
    {
        $this->getJson('/api/favorites')->assertUnauthorized();
        $this->withHeader('X-MadaTours-Client', '1')->deleteJson('/api/account', ['password' => 'valid password'])->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_signup_ignores_roles_and_never_exposes_tokens(): void
    {
        Http::fake([
            '*/rpc/mt_check_rate_limit' => Http::response('true'),
            '*/auth/v1/signup' => Http::response(['id' => 'user-id']),
        ]);
        $this->withHeader('X-MadaTours-Client', '1')->postJson('/api/auth/register', ['email' => ' USER@example.com ', 'password' => 'a long test password', 'role' => 'admin'])->assertCreated()->assertExactJson(['user' => null, 'verificationRequired' => true]);
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/signup') && $r['email'] === 'user@example.com' && ! isset($r['role']) && $r->header('apikey')[0] === 'public-key');
    }

    public function test_saved_places_use_validated_user_identity_and_user_bearer(): void
    {
        Http::fake([
            '*/auth/v1/user' => Http::response(['id' => 'alice', 'email' => 'alice@example.com']),
            '*/mt_profiles*' => Http::response([['role' => 'user']]),
            '*/mt_places*' => Http::response([['id' => 1]]),
            '*/mt_saved_places*' => Http::response(null, 201),
        ]);
        $this->withSession(['supabase' => ['access_token' => 'user-token', 'refresh_token' => 'refresh', 'expires_at' => time() + 3600]])->withHeader('X-MadaTours-Client', '1')->postJson('/api/favorites', ['placeId' => 1, 'user_id' => 'bob'])->assertOk();
        Http::assertSent(fn ($r) => $r->method() === 'POST' && str_contains($r->url(), '/mt_saved_places') && $r['user_id'] === 'alice' && $r->header('Authorization')[0] === 'Bearer user-token' && $r->header('apikey')[0] === 'public-key');
    }

    public function test_user_metadata_cannot_grant_administrator_access(): void
    {
        Http::fake([
            '*/auth/v1/user' => Http::response(['id' => 'alice', 'email' => 'alice@example.com', 'user_metadata' => ['role' => 'admin']]),
            '*/mt_profiles*' => Http::response([['role' => 'user']]),
        ]);
        $this->withSession(['supabase' => ['access_token' => 'user-token', 'refresh_token' => 'refresh', 'expires_at' => time() + 3600]])->withHeader('X-MadaTours-Client', '1')->postJson('/api/places', ['name' => 'No'])->assertForbidden();
    }

    public function test_expired_tokens_refresh_before_remote_validation(): void
    {
        Http::fake([
            '*/token?grant_type=refresh_token' => Http::response(['access_token' => 'new-token', 'refresh_token' => 'new-refresh', 'expires_in' => 3600]),
            '*/auth/v1/user' => Http::response(['id' => 'alice', 'email' => 'alice@example.com']),
            '*/mt_profiles*' => Http::response([['role' => 'user']]),
        ]);
        $this->withSession(['supabase' => ['access_token' => 'expired', 'refresh_token' => 'old-refresh', 'expires_at' => 1]])->getJson('/api/auth/session')->assertOk()->assertJsonPath('user.id', 'alice')->assertSessionHas('supabase.access_token', 'new-token');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/user') && $r->header('Authorization')[0] === 'Bearer new-token');
    }

    public function test_provider_outages_do_not_expose_provider_payloads(): void
    {
        Http::fake(['*' => Http::response(['message' => 'sensitive database detail'], 500)]);
        $this->getJson('/api/health')->assertStatus(503)->assertDontSee('sensitive database detail');
    }

    public function test_rate_limit_prevents_auth_request(): void
    {
        Http::fake(['*/rpc/mt_check_rate_limit' => Http::response('false')]);
        $this->withHeader('X-MadaTours-Client', '1')->postJson('/api/auth/login', ['email' => 'user@example.com', 'password' => 'password'])->assertStatus(429);
        Http::assertSentCount(1);
    }

    public function test_invalid_coordinates_do_not_query_database(): void
    {
        $this->getJson('/api/places?lat=&lng=0')->assertStatus(400);
        $this->getJson('/api/places?lat=91&lng=0')->assertStatus(400);
        Http::assertNothingSent();
    }

    public function test_catalogue_is_paginated_without_a_thousand_row_cutoff(): void
    {
        $place = ['id' => 1, 'name' => 'Place', 'type' => 'activity', 'lat' => 14.6, 'lng' => -61, 'location' => 'Martinique', 'description' => 'Test'];
        Http::fakeSequence()->push(array_fill(0, 500, $place))->push([$place + ['extra' => 'not exposed']]);
        $this->getJson('/api/places')->assertOk()->assertJsonCount(501)->assertJsonMissing(['extra' => 'not exposed']);
        Http::assertSent(fn ($r) => str_contains($r->url(), 'offset=500') && $r->header('apikey')[0] === 'public-key' && ! $r->hasHeader('Authorization'));
    }
}
