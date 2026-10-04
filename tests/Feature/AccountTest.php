<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AccountTest extends TestCase
{
    private const PASSWORD = 'correct horse battery';

    /** Requests the provider double saw, in order, as "METHOD /path". */
    private array $calls = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
        $this->withHeader('X-MadaTours-Client', '1')->withSession(['supabase' => ['access_token' => 'old-access', 'refresh_token' => 'old-refresh', 'expires_at' => time() + 3600]]);
    }

    /** @param array<int, string> $providers Identity providers on the account; only "email" means it has a password. */
    private function provider(array $providers = ['email'], bool $verified = true): void
    {
        $this->calls = [];
        Http::fake(function (Request $request) use ($providers, $verified) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            $this->calls[] = $request->method().' '.$path;
            if (str_ends_with($path, '/rpc/mt_check_rate_limit')) {
                return Http::response('true');
            }
            if ($path === '/auth/v1/token') {
                return $request['password'] === self::PASSWORD
                    ? Http::response(['access_token' => 'fresh-access', 'refresh_token' => 'fresh-refresh', 'expires_in' => 3600, 'user' => ['id' => 'original-user']])
                    : Http::response(['error_code' => 'invalid_credentials'], 400);
            }
            if ($path === '/auth/v1/user') {
                return Http::response([
                    'id' => 'original-user', 'email' => 'camille@example.test',
                    'user_metadata' => ['display_name' => 'Camille', 'language' => 'en'],
                    'identities' => array_map(fn ($provider) => ['provider' => $provider], $providers),
                ]);
            }
            if ($path === '/auth/v1/logout' || str_starts_with($path, '/auth/v1/admin/users/') || str_ends_with($path, '/mt_profiles') && $request->method() === 'PATCH') {
                return Http::response([]);
            }
            if (str_ends_with($path, '/mt_profiles')) {
                return Http::response([['role' => 'user', 'email_verified_at' => $verified ? '2026-10-01T00:00:00Z' : null]]);
            }
            if (str_ends_with($path, '/rpc/mt_recovery_codes_left')) {
                return Http::response('5');
            }
            if (str_ends_with($path, '/rpc/mt_replace_recovery_codes')) {
                return Http::response('', 204);
            }
            if (str_ends_with($path, '/mt_photo_deletions')) {
                return Http::response([]);
            }
            $this->fail('Unexpected provider request: '.$request->method().' '.$path);
        });
    }

    private function sent(string $call): bool
    {
        return in_array($call, $this->calls, true);
    }

    public function test_guests_cannot_change_or_delete_accounts(): void
    {
        Http::fake();
        $this->flushSession();
        $this->postJson('/api/account/profile', ['name' => 'Someone'])->assertUnauthorized();
        $this->postJson('/api/account/email', ['email' => 'a@example.test', 'password' => self::PASSWORD])->assertUnauthorized();
        $this->deleteJson('/api/account', ['confirmation' => 'camille@example.test', 'password' => self::PASSWORD])->assertUnauthorized();
        $this->getJson('/api/account/recovery-codes')->assertUnauthorized();
        $this->postJson('/api/account/recovery-codes', ['password' => self::PASSWORD])->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_session_reports_the_password_and_language_of_the_account(): void
    {
        $this->provider();
        $this->getJson('/api/auth/session')->assertOk()->assertJsonPath('user.hasPassword', true)->assertJsonPath('user.language', 'en');
    }

    public function test_session_reports_google_only_accounts_as_having_no_password(): void
    {
        $this->provider(['google']);
        $this->getJson('/api/auth/session')->assertOk()->assertJsonPath('user.hasPassword', false);
    }

    public function test_name_and_language_are_saved_to_the_signed_in_account_only(): void
    {
        $this->provider();
        // An id in the body must never choose which account is changed.
        $this->postJson('/api/account/profile', ['name' => '  Camille R.  ', 'language' => 'fr', 'id' => 'another-user', 'role' => 'admin'])
            ->assertOk()->assertJsonPath('user.id', 'original-user');
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/auth/v1/user')
            && $r['data'] === ['display_name' => 'Camille R.', 'language' => 'fr']
            && ! isset($r['id'], $r['role'])
            && $r->hasHeader('Authorization', 'Bearer old-access'));
    }

    public function test_language_alone_can_be_saved_and_a_numeric_name_is_not_dropped(): void
    {
        $this->provider();
        $this->postJson('/api/account/profile', ['language' => 'fr'])->assertOk();
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && $r['data'] === ['language' => 'fr']);
        $this->postJson('/api/account/profile', ['name' => '0'])->assertOk();
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && $r['data'] === ['display_name' => '0']);
    }

    public function test_invalid_names_and_languages_are_rejected_before_anything_is_saved(): void
    {
        $this->provider();
        foreach ([
            [[], 'Enter a name or choose a language.'],
            [['name' => '   '], 'Enter a name.'],
            [['name' => str_repeat('a', 81)], 'Your name can have up to 80 characters.'],
            [['name' => '<script>alert(1)</script>'], 'Your name cannot contain < or > or control characters.'],
            [['name' => "Bad\x07Name"], 'Your name cannot contain < or > or control characters.'],
            [['name' => 'Camille', 'language' => 'de'], 'Choose English or French.'],
        ] as [$body, $message]) {
            $this->postJson('/api/account/profile', $body)->assertStatus(400)->assertJsonPath('error', $message);
        }
        $this->assertFalse($this->sent('PUT /auth/v1/user'));
    }

    public function test_changing_email_needs_the_password_takes_effect_at_once_and_sends_nothing(): void
    {
        $this->provider();
        $this->postJson('/api/account/email', ['email' => ' New@Example.TEST ', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('verificationLost', true);
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/auth/v1/admin/users/original-user') && $r['email'] === 'new@example.test' && $r['email_confirm'] === true);
        $this->assertFalse($this->sent('POST /auth/v1/otp'), 'no email is requested');
        // The database clears the verified flag with the change; the server does not do it in a separate step.
        $this->assertFalse($this->sent('PATCH /rest/v1/mt_profiles'));
    }

    public function test_an_account_that_was_never_verified_just_changes_its_email(): void
    {
        $this->provider(verified: false);
        $this->postJson('/api/account/email', ['email' => 'new@example.test', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('verificationLost', false);
        $this->assertTrue($this->sent('PUT /auth/v1/admin/users/original-user'));
    }

    public function test_a_wrong_password_changes_nothing(): void
    {
        $this->provider();
        $this->postJson('/api/account/email', ['email' => 'new@example.test', 'password' => 'wrong password'])->assertStatus(400)->assertJsonPath('error', 'Incorrect password. Nothing was changed.');
        $this->assertFalse($this->sent('PUT /auth/v1/admin/users/original-user'));
        $this->assertFalse($this->sent('PATCH /rest/v1/mt_profiles'));
    }

    public function test_email_validation_and_unchanged_addresses_are_refused(): void
    {
        $this->provider();
        $this->postJson('/api/account/email', ['email' => 'not-an-email', 'password' => self::PASSWORD])->assertStatus(400)->assertJsonPath('error', 'Enter a valid email address.');
        $this->postJson('/api/account/email', ['password' => self::PASSWORD])->assertStatus(400)->assertJsonPath('error', 'Enter your new email address.');
        $this->postJson('/api/account/email', ['email' => 'new@example.test'])->assertStatus(400)->assertJsonPath('error', 'Enter your password to confirm.');
        $this->postJson('/api/account/email', ['email' => 'CAMILLE@example.test', 'password' => self::PASSWORD])->assertStatus(400)->assertJsonPath('error', 'This is already your email address.');
        $this->assertFalse($this->sent('PUT /auth/v1/admin/users/original-user'));
    }

    public function test_google_only_accounts_cannot_change_their_email(): void
    {
        $this->provider(['google']);
        $this->postJson('/api/account/email', ['email' => 'new@example.test', 'password' => self::PASSWORD])->assertStatus(409);
        $this->assertFalse($this->sent('PUT /auth/v1/admin/users/original-user'));
    }

    public function test_settings_show_how_many_recovery_codes_are_left(): void
    {
        $this->provider();
        $this->getJson('/api/account/recovery-codes')->assertOk()->assertExactJson(['remaining' => 5, 'total' => 8]);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_recovery_codes_left') && $r['target'] === 'original-user');
    }

    public function test_google_only_accounts_have_no_recovery_codes(): void
    {
        $this->provider(['google']);
        $this->getJson('/api/account/recovery-codes')->assertOk()->assertExactJson(['remaining' => 0, 'total' => 8]);
        $this->postJson('/api/account/recovery-codes', ['password' => self::PASSWORD])->assertStatus(409);
        $this->assertFalse($this->sent('POST /rest/v1/rpc/mt_replace_recovery_codes'));
    }

    public function test_new_recovery_codes_need_the_password_and_replace_the_old_set(): void
    {
        $this->provider();
        $codes = $this->postJson('/api/account/recovery-codes', ['password' => self::PASSWORD])->assertOk()->assertJsonCount(8, 'codes')->json('codes');
        $this->assertCount(8, array_unique($codes));
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_replace_recovery_codes') && $r['target'] === 'original-user' && count($r['hashes']) === 8
            && ! str_contains(json_encode($r->data()), str_replace('-', '', $codes[0])));
    }

    public function test_a_wrong_password_issues_no_recovery_codes(): void
    {
        $this->provider();
        $this->postJson('/api/account/recovery-codes', ['password' => 'wrong password'])->assertStatus(400)->assertJsonPath('error', 'Incorrect password. Nothing was changed.');
        $this->postJson('/api/account/recovery-codes', [])->assertStatus(400);
        $this->assertFalse($this->sent('POST /rest/v1/rpc/mt_replace_recovery_codes'));
    }

    public function test_deleting_needs_the_typed_email_before_anything_else_happens(): void
    {
        $this->provider();
        $this->deleteJson('/api/account', ['password' => self::PASSWORD])->assertStatus(400)->assertJsonPath('error', 'Type your email address exactly to confirm.');
        $this->deleteJson('/api/account', ['confirmation' => 'someone-else@example.test', 'password' => self::PASSWORD])->assertStatus(400)->assertJsonPath('error', 'Type your email address exactly to confirm.');
        $this->deleteJson('/api/account', ['confirmation' => 'camille@example.test'])->assertStatus(400)->assertJsonPath('error', 'Enter your password to confirm.');
        $this->assertFalse($this->sent('POST /auth/v1/token'));
        $this->assertFalse($this->sent('DELETE /auth/v1/admin/users/original-user'));
    }

    public function test_a_wrong_password_does_not_delete_the_account(): void
    {
        $this->provider();
        $this->deleteJson('/api/account', ['confirmation' => 'camille@example.test', 'password' => 'wrong password'])->assertStatus(400)->assertJsonPath('error', 'Incorrect password. Nothing was changed.');
        $this->assertFalse($this->sent('DELETE /auth/v1/admin/users/original-user'));
    }

    public function test_deleting_signs_out_everywhere_then_removes_the_account(): void
    {
        $this->provider();
        $this->deleteJson('/api/account', ['confirmation' => '  CAMILLE@example.test ', 'password' => self::PASSWORD])
            ->assertOk()->assertExactJson(['success' => true])->assertSessionMissing('supabase');
        $this->assertSame(
            ['POST /auth/v1/logout', 'DELETE /auth/v1/admin/users/original-user'],
            array_values(array_filter($this->calls, fn ($call) => str_contains($call, '/logout') || str_starts_with($call, 'DELETE /auth'))),
        );
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/auth/v1/logout?scope=global'));
    }

    public function test_google_only_accounts_can_delete_with_the_typed_email_alone(): void
    {
        $this->provider(['google']);
        $this->deleteJson('/api/account', ['confirmation' => 'camille@example.test'])->assertOk();
        $this->assertFalse($this->sent('POST /auth/v1/token'));
        $this->assertTrue($this->sent('DELETE /auth/v1/admin/users/original-user'));
    }
}
