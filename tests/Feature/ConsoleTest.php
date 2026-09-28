<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ConsoleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['supabase.url' => 'https://project.supabase.co', 'supabase.secret_key' => 'server-secret']);
        Http::preventStrayRequests();
    }

    public function test_admin_provisioning_requires_a_verified_existing_account(): void
    {
        Http::fake(['*/admin/users*' => Http::response(['users' => [['id' => 'a', 'email' => 'user@example.com']]])]);
        $this->artisan('admin:grant', ['email' => 'user@example.com'])->assertFailed();
        Http::assertSentCount(1);
    }

    public function test_admin_provisioning_updates_only_the_selected_profile(): void
    {
        Http::fake([
            '*/admin/users*' => Http::response(['users' => [['id' => 'a', 'email' => 'user@example.com', 'email_confirmed_at' => '2026-09-26']]]),
            '*/mt_profiles*' => Http::response([['id' => 'a', 'role' => 'admin']]),
        ]);
        $this->artisan('admin:grant', ['email' => ' USER@example.com '])->assertSuccessful();
        Http::assertSent(fn ($request) => $request->method() === 'PATCH'
            && str_ends_with($request->url(), '/mt_profiles?id=eq.a')
            && $request['role'] === 'admin'
            && $request->header('apikey')[0] === 'server-secret');
    }

    public function test_invalid_admin_email_does_not_contact_the_provider(): void
    {
        $this->artisan('admin:grant', ['email' => 'invalid'])->assertFailed();
        Http::assertNothingSent();
    }

    public function test_creating_an_existing_admin_never_resets_a_password_implicitly(): void
    {
        Http::fake(['*/admin/users*' => Http::response(['users' => [['id' => 'a', 'email' => 'user@example.com']]])]);
        $this->artisan('admin:create', ['email' => 'user@example.com'])->assertFailed();
        Http::assertSentCount(1);
    }

    public function test_admin_password_is_verified_and_stored_privately_without_printing_it(): void
    {
        config(['supabase.publishable_key' => 'public-key']);
        $generated = null;
        Http::fake(function ($request) use (&$generated) {
            if ($request->method() === 'GET') {
                return Http::response(['users' => [['id' => 'a', 'email' => 'user@example.com', 'user_metadata' => ['language' => 'fr']]]]);
            }
            if ($request->method() === 'PUT') {
                $generated = $request['password'];
                $this->assertTrue($request['email_confirm']);
                $this->assertSame('Kervin', $request['user_metadata']['display_name']);
                $this->assertSame('fr', $request['user_metadata']['language']);

                return Http::response(['id' => 'a']);
            }
            if ($request->method() === 'PATCH') {
                $this->assertSame('admin', $request['role']);

                return Http::response([['id' => 'a', 'role' => 'admin']]);
            }
            if (str_contains($request->url(), 'grant_type=password')) {
                $this->assertSame($generated, $request['password']);

                return Http::response(['user' => ['id' => 'a'], 'access_token' => 'temporary-token']);
            }
            $this->assertStringContainsString('logout?scope=global', $request->url());

            return Http::response(null, 204);
        });
        $status = Artisan::call('admin:create', ['email' => 'user@example.com', '--name' => 'Kervin', '--replace-password' => true]);
        $output = Artisan::output();
        preg_match('/Private credentials: (.+)/', $output, $matches);
        $file = trim($matches[1] ?? '');
        try {
            $this->assertSame(0, $status, $output);
            $this->assertGreaterThanOrEqual(32, strlen($generated));
            $this->assertStringNotContainsString($generated, $output);
            $this->assertSame(0600, fileperms($file) & 0777);
            $record = json_decode(file_get_contents($file), true);
            $this->assertSame($generated, $record['password']);
            $this->assertSame('verified', $record['status']);
        } finally {
            if ($file && is_file($file)) {
                unlink($file);
            }
        }
    }
}
