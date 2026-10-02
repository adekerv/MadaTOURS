<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
        $this->withHeader('X-MadaTours-Client', '1')->withSession(['supabase' => ['access_token' => 'old-access', 'refresh_token' => 'old-refresh', 'expires_at' => time() + 3600]]);
    }

    private function provider(array $verification, int $status = 200, bool $differentAccount = false): void
    {
        $verified = false;
        Http::fake(function ($request) use ($verification, $status, $differentAccount, &$verified) {
            if (str_ends_with($request->url(), '/rpc/mt_check_rate_limit')) return Http::response('true');
            if (str_ends_with($request->url(), '/auth/v1/verify')) return Http::response($verification, $status);
            if (str_ends_with($request->url(), '/auth/v1/otp')) return Http::response([]);
            if (str_ends_with($request->url(), '/auth/v1/user')) {
                $other = $differentAccount && $request->hasHeader('Authorization', 'Bearer verified-access');
                return Http::response(['id' => $other ? 'another-user' : 'original-user', 'email' => $other ? 'other@example.test' : 'camille@example.test', 'email_confirmed_at' => '2026-01-01T00:00:00Z']);
            }
            if (str_contains($request->url(), '/mt_profiles')) {
                if ($request->method() === 'PATCH') { $verified = true; return Http::response([]); }
                return Http::response([['role' => 'user', 'email_verified_at' => $verified ? '2026-10-01T00:00:00Z' : null]]);
            }
            $this->fail('Unexpected provider request');
        });
    }

    public function test_legacy_auto_confirmation_does_not_prove_email_ownership(): void
    {
        $this->provider([]);
        $this->getJson('/api/auth/session')->assertOk()->assertJsonPath('user.emailVerified', false);
        $this->postJson('/api/account/verification/send', ['email' => 'attacker@example.test'])->assertOk();
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/otp') && $r['email'] === 'camille@example.test' && $r['create_user'] === false);
    }

    public function test_otp_confirmation_marks_only_the_current_account_verified(): void
    {
        $this->provider(['access_token' => 'verified-access', 'refresh_token' => 'verified-refresh', 'expires_in' => 3600]);
        $this->postJson('/api/account/verification/confirm', ['token' => '123456'])->assertOk()->assertJsonPath('user.emailVerified', true);
        Http::assertSent(fn ($r) => $r->method() === 'PATCH' && str_ends_with($r->url(), '/mt_profiles?id=eq.original-user') && ! empty($r['email_verified_at']));
    }

    public function test_incomplete_provider_response_never_confirms_an_existing_session(): void
    {
        $this->provider([]);
        $this->postJson('/api/account/verification/confirm', ['token' => '123456'])->assertStatus(502);
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH');
    }

    public function test_wrong_account_response_clears_the_session_and_does_not_verify(): void
    {
        $this->provider(['access_token' => 'verified-access', 'refresh_token' => 'verified-refresh', 'expires_in' => 3600], differentAccount: true);
        $this->postJson('/api/account/verification/confirm', ['token' => '123456'])->assertForbidden()->assertSessionMissing('supabase');
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH');
    }

    public function test_rejected_code_never_updates_verification(): void
    {
        $this->provider(['error_code' => 'otp_expired'], 403);
        $this->postJson('/api/account/verification/confirm', ['token' => '123456'])->assertStatus(400);
        Http::assertNotSent(fn ($r) => $r->method() === 'PATCH');
    }
}
