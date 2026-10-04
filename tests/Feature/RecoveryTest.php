<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class RecoveryTest extends TestCase
{
    private const CODE = 'K7QM2-WX4TP';

    /** Requests the provider double saw, in order, as "METHOD /path". */
    private array $calls = [];

    /** @var array<string, int> */
    private array $hits = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key', 'supabase.recovery_code_cost' => 4]);
        Http::preventStrayRequests();
        $this->withHeader('X-MadaTours-Client', '1');
    }

    /**
     * @param  array<string, mixed>  $options  known (the account has codes), consumable (the code is still unused), updateWorks, revokeWorks
     */
    private function provider(array $options = []): void
    {
        $this->calls = [];
        $this->hits = [];
        $options += ['known' => true, 'consumable' => true, 'updateWorks' => true, 'revokeWorks' => true];
        Http::fake(function (Request $request) use ($options) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            $this->calls[] = $request->method().' '.$path;
            if (str_ends_with($path, '/rpc/mt_check_rate_limit')) {
                // Behaves like the database function: the (n+1)th hit on one identifier is refused.
                $key = $request['identifier'];
                $this->hits[$key] = ($this->hits[$key] ?? 0) + 1;
                $this->ceilings[$key] = $request['ceiling'];

                return Http::response($this->hits[$key] <= $request['ceiling'] ? 'true' : 'false');
            }
            if (str_ends_with($path, '/rpc/mt_recovery_candidates')) {
                return Http::response($options['known'] ? [['userId' => 'original-user', 'codeId' => 41, 'hash' => Hash::driver('bcrypt')->make('K7QM2WX4TP', ['rounds' => 4])], ['userId' => 'original-user', 'codeId' => 42, 'hash' => Hash::driver('bcrypt')->make('AAAAABBBBB', ['rounds' => 4])]] : []);
            }
            if (str_ends_with($path, '/rpc/mt_consume_recovery_code')) {
                return Http::response($options['consumable'] ? 'true' : 'false');
            }
            if ($path === '/auth/v1/admin/users/original-user') {
                return $options['updateWorks'] ? Http::response([]) : Http::response(['error_code' => 'unexpected_failure'], 500);
            }
            if (str_ends_with($path, '/rpc/mt_revoke_user_sessions')) {
                return $options['revokeWorks'] ? Http::response('', 204) : Http::response(['code' => 'XX000'], 500);
            }
            if (str_ends_with($path, '/mt_recovery_codes')) {
                return Http::response([]);
            }
            $this->fail('Unexpected provider request: '.$request->method().' '.$path);
        });
    }

    /** @var array<string, int> */
    private array $ceilings = [];

    private function reset(array $body = []): TestResponse
    {
        return $this->postJson('/api/auth/recover', $body + ['email' => ' Camille@Example.TEST ', 'code' => self::CODE, 'password' => 'a brand new password']);
    }

    private function sent(string $call): bool
    {
        return in_array($call, $this->calls, true);
    }

    public function test_a_valid_code_resets_the_password_uses_the_code_up_and_signs_the_account_out_everywhere(): void
    {
        $this->provider();
        $this->reset(['code' => ' k7qm2 wx4tp '])->assertOk()->assertExactJson(['success' => true]);
        $this->assertSame(
            ['POST /rest/v1/rpc/mt_recovery_candidates', 'POST /rest/v1/rpc/mt_consume_recovery_code', 'PUT /auth/v1/admin/users/original-user', 'POST /rest/v1/rpc/mt_revoke_user_sessions'],
            array_values(array_filter($this->calls, fn ($c) => ! str_contains($c, 'rate_limit'))),
        );
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_recovery_candidates') && $r['account_email'] === 'camille@example.test');
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_consume_recovery_code') && $r['code_id'] === 41);
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/auth/v1/admin/users/original-user') && $r['password'] === 'a brand new password' && $r->hasHeader('apikey', 'private-key'));
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_revoke_user_sessions') && $r['target'] === 'original-user');
    }

    public function test_a_wrong_code_an_unknown_email_and_an_account_without_codes_all_look_the_same(): void
    {
        $this->provider();
        $wrong = $this->reset(['code' => 'ZZZZZ-ZZZZZ'])->assertStatus(400)->assertJsonPath('error', 'The email or recovery code is not valid.');
        $this->assertFalse($this->sent('POST /rest/v1/rpc/mt_consume_recovery_code'));
        $this->assertFalse($this->sent('PUT /auth/v1/admin/users/original-user'));
        $this->assertSame(400, $wrong->status());
    }

    public function test_an_unknown_email_gets_the_same_answer_and_changes_nothing(): void
    {
        $this->provider(['known' => false]);
        $this->reset()->assertStatus(400)->assertJsonPath('error', 'The email or recovery code is not valid.');
        $this->assertFalse($this->sent('PUT /auth/v1/admin/users/original-user'));
    }

    public function test_a_code_that_was_just_used_cannot_be_used_again(): void
    {
        // The database refuses the second claim: only one caller gets to consume a code.
        $this->provider(['consumable' => false]);
        $this->reset()->assertStatus(400)->assertJsonPath('error', 'The email or recovery code is not valid.');
        $this->assertFalse($this->sent('PUT /auth/v1/admin/users/original-user'), 'the password is not changed without winning the claim');
    }

    public function test_attempts_are_limited_per_email_and_per_address(): void
    {
        $this->provider();
        for ($i = 1; $i <= 5; $i++) {
            $this->reset(['code' => 'ZZZZZ-ZZZZ'.$i])->assertStatus(400);
        }
        $this->reset(['code' => 'ZZZZZ-ZZZZ6'])->assertStatus(429)->assertJsonPath('error', 'Too many attempts. Please try again in 15 minutes.');
        $this->assertContains(5, $this->ceilings, 'the email gets five attempts');
        $this->assertContains(config('supabase.auth_attempts_per_ip'), $this->ceilings, 'the address has its own, higher ceiling');
        // Refused attempts never reach the code check.
        $this->assertSame(5, count(array_filter($this->calls, fn ($c) => $c === 'POST /rest/v1/rpc/mt_recovery_candidates')));
    }

    public function test_a_failed_password_update_gives_the_code_back(): void
    {
        $this->provider(['updateWorks' => false]);
        // A provider outage is reported as one, and the code is not lost to it.
        $this->reset()->assertStatus(503);
        Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_recovery_codes?id=eq.41') && array_key_exists('used_at', $r->data()) && $r['used_at'] === null);
    }

    public function test_a_failure_signing_other_sessions_out_does_not_undo_the_reset(): void
    {
        $this->provider(['revokeWorks' => false]);
        $this->reset()->assertOk();
    }

    public function test_the_request_is_checked_before_any_code_is_looked_at(): void
    {
        $this->provider();
        $this->reset(['password' => 'short'])->assertStatus(400);
        $this->reset(['code' => 'bad'])->assertStatus(400)->assertJsonPath('error', 'Enter a recovery code exactly as you saved it, for example K7QM2-WX4TP.');
        $this->reset(['code' => ''])->assertStatus(400);
        $this->reset(['email' => 'not-an-email'])->assertStatus(400);
        $this->assertFalse($this->sent('POST /rest/v1/rpc/mt_recovery_candidates'));
    }

    public function test_the_old_email_based_routes_are_gone(): void
    {
        Http::fake();
        foreach (['forgot-password', 'reset-password', 'verify', 'resend'] as $route) {
            $this->postJson('/api/auth/'.$route, ['email' => 'a@example.test'])->assertNotFound();
        }
        Http::assertNothingSent();
    }
}
