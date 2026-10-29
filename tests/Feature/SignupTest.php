<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SignupTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
        $this->withHeader('X-MadaTours-Client', '1');
    }

    private function provider(): void
    {
        Http::fake([
            '*/rpc/mt_check_rate_limit' => Http::response('true'),
            '*/auth/v1/signup' => Http::response(['access_token' => 'private-access', 'refresh_token' => 'private-refresh', 'expires_in' => 3600]),
            '*/auth/v1/user' => Http::response(['id' => 'new-user', 'email' => 'user@example.com', 'user_metadata' => ['display_name' => 'Camille', 'role' => 'admin']]),
            '*/mt_profiles*' => Http::response([['role' => 'user']]),
            '*/rpc/mt_replace_recovery_codes' => Http::response('', 204),
        ]);
    }

    public function test_signup_signs_in_immediately_with_a_display_name_but_no_role_from_input(): void
    {
        $this->provider();
        $this->postJson('/api/auth/register', ['name' => ' Camille ', 'email' => ' USER@example.com ', 'password' => 'a long test password', 'password_confirmation' => 'a long test password', 'language' => 'fr', 'role' => 'admin', 'data' => ['role' => 'admin']])
            ->assertCreated()->assertJsonPath('user.name', 'Camille')->assertJsonPath('user.role', 'user')->assertJsonPath('verificationRequired', false)
            ->assertDontSee('private-access')->assertDontSee('private-refresh')->assertSessionHas('supabase.access_token', 'private-access');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/signup') && $r['data'] === ['display_name' => 'Camille', 'language' => 'fr'] && ! isset($r['role']) && $r['email'] === 'user@example.com');
    }

    public function test_signup_issues_eight_recovery_codes_once_and_stores_only_hashes(): void
    {
        $this->provider();
        $codes = $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password', 'password_confirmation' => 'a long test password'])
            ->assertCreated()->assertJsonCount(8, 'recoveryCodes')->json('recoveryCodes');
        $this->assertCount(8, array_unique($codes));
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[A-HJKMNP-TV-Z2-9]{5}-[A-HJKMNP-TV-Z2-9]{5}$/', $code);
        }
        Http::assertSent(function (Request $r) use ($codes) {
            if (! str_ends_with($r->url(), '/rpc/mt_replace_recovery_codes')) {
                return false;
            }
            $sent = json_encode($r->data());
            foreach ($codes as $code) {
                // The server never sends a readable code to the database.
                if (str_contains($sent, $code) || str_contains($sent, str_replace('-', '', $code))) {
                    return false;
                }
            }

            return $r['target'] === 'new-user' && count($r['hashes']) === 8
                && collect($codes)->every(fn ($code, $i) => Hash::check(str_replace('-', '', $code), $r['hashes'][$i]));
        });
    }

    public function test_a_failure_issuing_codes_never_breaks_signup(): void
    {
        Http::fake([
            '*/rpc/mt_check_rate_limit' => Http::response('true'),
            '*/auth/v1/signup' => Http::response(['access_token' => 'a', 'refresh_token' => 'r', 'expires_in' => 3600]),
            '*/auth/v1/user' => Http::response(['id' => 'new-user', 'email' => 'user@example.com', 'user_metadata' => ['display_name' => 'Camille']]),
            '*/mt_profiles*' => Http::response([['role' => 'user']]),
            '*/rpc/mt_replace_recovery_codes' => Http::response(['code' => 'XX000'], 500),
        ]);
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password', 'password_confirmation' => 'a long test password'])
            ->assertCreated()->assertJsonPath('user.name', 'Camille')->assertJsonMissingPath('recoveryCodes');
    }

    public function test_invalid_or_missing_name_does_not_create_an_account(): void
    {
        foreach (['', '<script>alert(1)</script>', str_repeat('a', 81)] as $name) {
            $this->postJson('/api/auth/register', ['name' => $name, 'email' => 'user@example.com', 'password' => 'a long test password', 'password_confirmation' => 'a long test password'])->assertStatus(400);
        }
        Http::assertNothingSent();
    }

    public function test_provider_rejection_reports_an_existing_account(): void
    {
        Http::fake(['*/rpc/mt_check_rate_limit' => Http::response('true'), '*/auth/v1/signup' => Http::response(['code' => 422, 'error_code' => 'user_already_exists', 'msg' => 'User already registered'], 422)]);
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password', 'password_confirmation' => 'a long test password'])
            ->assertStatus(409)->assertJsonPath('error', 'An account already uses this email address.');
    }

    public function test_provider_password_rules_are_explained_instead_of_a_generic_error(): void
    {
        Http::fake(['*/rpc/mt_check_rate_limit' => Http::response('true'), '*/auth/v1/signup' => Http::response(['code' => 422, 'error_code' => 'weak_password', 'msg' => 'Password should contain at least one character of each'], 422)]);
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password', 'password_confirmation' => 'a long test password'])
            ->assertStatus(400)->assertJsonPath('error', 'This password is too easy to guess. Choose a longer or less common one.');
    }

    public function test_a_suspended_account_is_told_so_after_signup(): void
    {
        Http::fake([
            '*/rpc/mt_check_rate_limit' => Http::response('true'),
            '*/auth/v1/signup' => Http::response(['access_token' => 'a', 'refresh_token' => 'r', 'expires_in' => 3600]),
            '*/auth/v1/user' => Http::response(['code' => 403, 'error_code' => 'user_banned', 'msg' => 'User is banned'], 403),
        ]);
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password', 'password_confirmation' => 'a long test password'])
            ->assertStatus(403)->assertJsonPath('error', 'This account is suspended. Contact us if you think this is a mistake.');
    }

    public function test_signup_needs_the_password_twice_and_checks_nothing_remotely_when_they_differ(): void
    {
        Http::fake();
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password', 'password_confirmation' => 'a long test passw0rd'])
            ->assertStatus(400)->assertJsonPath('error', 'The passwords do not match.');
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password'])
            ->assertStatus(400)->assertJsonPath('error', 'The passwords do not match.');
        Http::assertNothingSent();
    }

    public function test_existing_users_get_a_name_fallback_without_metadata_granting_roles(): void
    {
        Http::fake(['*/auth/v1/user' => Http::response(['id' => 'old-user', 'email' => 'camille@example.com']), '*/mt_profiles*' => Http::response([['role' => 'user']])]);
        $this->withSession(['supabase' => ['access_token' => 'token', 'refresh_token' => 'refresh', 'expires_at' => time() + 3600]])
            ->getJson('/api/auth/session')->assertOk()->assertJsonPath('user.name', 'camille');
    }
}
