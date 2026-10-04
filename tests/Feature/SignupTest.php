<?php

namespace Tests\Feature;

use App\Mail\WelcomeMail;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SignupTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
        Mail::fake();
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

    public function test_signup_signs_in_immediately_and_sends_a_personalized_welcome(): void
    {
        $this->provider();
        $this->postJson('/api/auth/register', ['name' => ' Camille ', 'email' => ' USER@example.com ', 'password' => 'a long test password', 'language' => 'fr', 'role' => 'admin', 'data' => ['role' => 'admin']])
            ->assertCreated()->assertJsonPath('user.name', 'Camille')->assertJsonPath('user.role', 'user')->assertJsonPath('verificationRequired', false)
            ->assertDontSee('private-access')->assertDontSee('private-refresh')->assertSessionHas('supabase.access_token', 'private-access');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/signup') && $r['data'] === ['display_name' => 'Camille', 'language' => 'fr'] && ! isset($r['role']) && $r['email'] === 'user@example.com');
        Mail::assertSent(WelcomeMail::class, fn ($mail) => $mail->hasTo('user@example.com') && $mail->displayName === 'Camille' && $mail->language === 'fr');
        Mail::assertSentCount(1);
    }

    public function test_signup_issues_eight_recovery_codes_once_and_stores_only_hashes(): void
    {
        $this->provider();
        $codes = $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password'])
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
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password'])
            ->assertCreated()->assertJsonPath('user.name', 'Camille')->assertJsonMissingPath('recoveryCodes');
    }

    public function test_invalid_or_missing_name_does_not_create_an_account(): void
    {
        foreach (['', '<script>alert(1)</script>', str_repeat('a', 81)] as $name) {
            $this->postJson('/api/auth/register', ['name' => $name, 'email' => 'user@example.com', 'password' => 'a long test password'])->assertStatus(400);
        }
        Http::assertNothingSent();
        Mail::assertNothingSent();
    }

    public function test_provider_rejection_never_sends_a_welcome(): void
    {
        Http::fake(['*/rpc/mt_check_rate_limit' => Http::response('true'), '*/auth/v1/signup' => Http::response(['error_code' => 'user_already_exists'], 422)]);
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password'])->assertStatus(400);
        Mail::assertNothingSent();
    }

    public function test_mail_outage_does_not_break_a_successful_signup_or_expose_details(): void
    {
        $this->provider();
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('secret smtp password'));
        Log::shouldReceive('warning')->once()->with('Welcome email delivery failed. Check the configured mail transport.');
        $this->postJson('/api/auth/register', ['name' => 'Camille', 'email' => 'user@example.com', 'password' => 'a long test password'])
            ->assertCreated()->assertJsonPath('user.name', 'Camille')->assertDontSee('secret smtp password');
    }

    public function test_existing_users_get_a_name_fallback_without_metadata_granting_roles(): void
    {
        Http::fake(['*/auth/v1/user' => Http::response(['id' => 'old-user', 'email' => 'camille@example.com']), '*/mt_profiles*' => Http::response([['role' => 'user']])]);
        $this->withSession(['supabase' => ['access_token' => 'token', 'refresh_token' => 'refresh', 'expires_at' => time() + 3600]])
            ->getJson('/api/auth/session')->assertOk()->assertJsonPath('user.name', 'camille');
        Mail::assertNothingSent();
    }

    public function test_welcome_mail_escapes_the_name_and_contains_no_verification_code(): void
    {
        $html = (new WelcomeMail('<strong>Camille</strong>', 'fr'))->render();
        $this->assertStringContainsString('&lt;strong&gt;Camille&lt;/strong&gt;', $html);
        $this->assertStringContainsString('Merci pour votre inscription', $html);
        $this->assertStringNotContainsString('one-time-code', $html);
    }
}
