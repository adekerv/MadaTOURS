<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleSignInTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key', 'supabase.app_origin' => 'https://madatours.test']);
        Http::preventStrayRequests();
    }

    /** @param array<string, mixed> $identity */
    private function provider(array $identity, ?string $verifiedAt = null, bool $password = false, array $metadata = []): void
    {
        Http::fake(function ($request) use ($identity, $verifiedAt, $password, $metadata) {
            $url = $request->url();
            if (str_ends_with($url, '/rpc/mt_check_rate_limit')) {
                return Http::response('true');
            }
            if (str_contains($url, '/auth/v1/token?grant_type=pkce')) {
                return Http::response(['access_token' => 'google-access', 'refresh_token' => 'google-refresh', 'expires_in' => 3600]);
            }
            if (str_ends_with($url, '/auth/v1/user') && $request->method() === 'GET') {
                $identities = [['provider' => 'google', 'identity_data' => $identity]];
                if ($password) {
                    $identities[] = ['provider' => 'email', 'identity_data' => ['email' => 'camille@example.test']];
                }

                return Http::response(['id' => 'user-1', 'email' => 'camille@example.test', 'identities' => $identities, 'user_metadata' => $metadata]);
            }
            if (str_contains($url, '/mt_profiles')) {
                return Http::response($request->method() === 'PATCH' ? [] : [['role' => 'user', 'email_verified_at' => $verifiedAt]]);
            }
            if (str_contains($url, '/auth/v1/admin/users/') || str_contains($url, '/auth/v1/logout') || str_ends_with($url, '/auth/v1/user')) {
                return Http::response([]);
            }
            $this->fail('Unexpected provider request: '.$url);
        });
    }

    public function test_start_keeps_the_verifier_on_the_server_and_redirects_to_google(): void
    {
        $this->provider([]);
        $response = $this->get('https://madatours.test/api/auth/google')->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertStringStartsWith('https://project.supabase.co/auth/v1/authorize?', $location);
        parse_str(parse_url($location, PHP_URL_QUERY), $query);
        $this->assertSame('google', $query['provider']);
        $this->assertSame('https://madatours.test/api/auth/google/callback', $query['redirect_to']);
        $this->assertSame('s256', $query['code_challenge_method']);
        $verifier = session('oauth_verifier');
        $this->assertIsString($verifier);
        $this->assertStringNotContainsString($verifier, $location);
        $this->assertSame(rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='), $query['code_challenge']);
    }

    public function test_sign_in_started_on_another_host_moves_to_the_app_origin_first(): void
    {
        $this->provider([]);
        $this->get('https://mada-tours.vercel.app/api/auth/google')->assertRedirect('https://madatours.test/api/auth/google');
        $this->assertNull(session('oauth_verifier'));
        Http::assertNothingSent();
    }

    public function test_callback_without_a_started_sign_in_is_rejected_without_provider_calls(): void
    {
        $this->provider([]);
        $this->get('/api/auth/google/callback?code=abc')->assertRedirect('https://madatours.test/?auth_error=failed');
        Http::assertNothingSent();
    }

    public function test_cancelled_google_consent_returns_a_friendly_status(): void
    {
        $this->provider([]);
        $this->withSession(['oauth_verifier' => 'verifier'])->get('/api/auth/google/callback?error=access_denied')->assertRedirect('https://madatours.test/?auth_error=cancelled');
        Http::assertNothingSent();
    }

    public function test_google_verified_email_marks_the_account_verified_and_names_it(): void
    {
        $this->provider(['email' => 'camille@example.test', 'email_verified' => true], metadata: ['full_name' => 'Camille Rakoto']);
        $this->withSession(['oauth_verifier' => 'verifier'])->get('/api/auth/google/callback?code=abc')->assertRedirect('https://madatours.test/?signed_in=google');
        $this->assertSame('google-access', session('supabase.access_token'));
        $this->assertNull(session('oauth_verifier'));
        Http::assertSent(fn ($r) => str_contains($r->url(), 'grant_type=pkce') && $r['auth_code'] === 'abc' && $r['code_verifier'] === 'verifier');
        Http::assertSent(fn ($r) => $r->method() === 'PATCH' && str_contains($r->url(), 'email_verified_at=is.null'));
        Http::assertSent(fn ($r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/auth/v1/user') && $r['data']['display_name'] === 'Camille Rakoto');
        Http::assertNotSent(fn ($r) => str_contains($r->url(), '/admin/users/'));
    }

    public function test_an_unproven_password_on_the_same_email_is_replaced_and_other_sessions_end(): void
    {
        $this->provider(['email' => 'camille@example.test', 'email_verified' => true], password: true, metadata: ['display_name' => 'Camille']);
        $this->withSession(['oauth_verifier' => 'verifier'])->get('/api/auth/google/callback?code=abc')->assertRedirect('https://madatours.test/?signed_in=google');
        Http::assertSent(fn ($r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/auth/v1/admin/users/user-1') && strlen($r['password']) === 64);
        Http::assertSent(fn ($r) => str_contains($r->url(), '/auth/v1/logout?scope=others'));
    }

    public function test_an_already_verified_account_keeps_its_password(): void
    {
        $this->provider(['email' => 'camille@example.test', 'email_verified' => true], '2026-09-01T00:00:00Z', true, ['display_name' => 'Camille']);
        $this->withSession(['oauth_verifier' => 'verifier'])->get('/api/auth/google/callback?code=abc')->assertRedirect('https://madatours.test/?signed_in=google');
        Http::assertNotSent(fn ($r) => str_contains($r->url(), '/admin/users/') || str_contains($r->url(), '/logout') || $r->method() === 'PATCH');
    }

    public function test_an_unverified_google_email_is_not_trusted(): void
    {
        $this->provider(['email' => 'camille@example.test', 'email_verified' => false], password: true, metadata: ['display_name' => 'Camille']);
        $this->withSession(['oauth_verifier' => 'verifier'])->get('/api/auth/google/callback?code=abc')->assertRedirect('https://madatours.test/?signed_in=google');
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH' || str_contains($r->url(), '/admin/users/'));
    }
}
