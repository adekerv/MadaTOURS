<?php

namespace Tests\Feature;

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
}
