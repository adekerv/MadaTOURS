<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AdminTest extends TestCase
{
    private const ME = '11111111-1111-4111-8111-111111111111';

    private const OTHER = '22222222-2222-4222-8222-222222222222';

    /** Requests the provider double saw, in order, as "METHOD /path". */
    private array $calls = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
        $this->withHeader('X-MadaTours-Client', '1')->withSession(['supabase' => ['access_token' => 'admin-access', 'refresh_token' => 'admin-refresh', 'expires_at' => time() + 3600]]);
    }

    /** @param array<string, mixed> $rpc Answers for database functions, by name */
    private function provider(string $role = 'admin', array $rpc = [], string $otherRole = 'user'): void
    {
        $this->calls = [];
        Http::fake(function (Request $request) use ($role, $rpc, $otherRole) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            $this->calls[] = $request->method().' '.$path;
            if ($path === '/auth/v1/user') {
                return Http::response(['id' => self::ME, 'email' => 'ade@admin.test', 'identities' => [['provider' => 'email']]]);
            }
            if (str_ends_with($path, '/mt_profiles')) {
                return Http::response([['role' => $role, 'email_verified_at' => null]]);
            }
            if (str_ends_with($path, '/rpc/mt_admin_user')) {
                return Http::response(['id' => $request['target'], 'email' => 'mia@example.test', 'role' => $request['target'] === self::ME ? 'admin' : $otherRole]);
            }
            if (str_ends_with($path, '/rpc/mt_check_rate_limit')) {
                return Http::response('true');
            }
            if (str_contains($path, '/rpc/')) {
                $name = substr($path, strrpos($path, '/') + 1);

                return Http::response($rpc[$name] ?? []);
            }
            if (str_starts_with($path, '/auth/v1/admin/users/') || str_ends_with($path, '/mt_contact_messages')) {
                return Http::response([]);
            }
            if (str_ends_with($path, '/mt_site_settings')) {
                return Http::response([['content' => $request->method() === 'PATCH' ? $request['content'] : ['hero' => ['title' => 'Bonjour']], 'updated_at' => '2026-10-14T10:00:00Z']]);
            }
            $this->fail('Unexpected provider request: '.$request->method().' '.$path);
        });
    }

    private function sentTo(string $prefix): bool
    {
        return collect($this->calls)->contains(fn ($call) => str_starts_with($call, $prefix));
    }

    /** @return list<array{0: string, 1: string, 2?: array<string, mixed>}> */
    private static function adminRoutes(): array
    {
        return [
            ['GET', '/api/admin/overview'], ['GET', '/api/admin/log'], ['GET', '/api/admin/users'],
            ['GET', '/api/admin/users/'.self::OTHER], ['POST', '/api/admin/users/'.self::OTHER.'/role', ['role' => 'admin']],
            ['POST', '/api/admin/users/'.self::OTHER.'/suspend'], ['POST', '/api/admin/users/'.self::OTHER.'/reactivate'],
            ['POST', '/api/admin/users/'.self::OTHER.'/password'], ['DELETE', '/api/admin/users/'.self::OTHER],
            ['GET', '/api/admin/meetups'], ['GET', '/api/admin/meetups/export'], ['GET', '/api/admin/meetups/1'],
            ['POST', '/api/admin/meetups/1/status', ['status' => 'cancelled']], ['POST', '/api/admin/meetups/1/requests/'.self::OTHER, ['status' => 'accepted']],
            ['GET', '/api/admin/reviews'], ['POST', '/api/admin/reviews/1/hide'], ['DELETE', '/api/admin/reviews/1'],
            ['GET', '/api/admin/messages'], ['POST', '/api/admin/messages/1', ['status' => 'handled']], ['DELETE', '/api/admin/messages/1'],
            ['POST', '/api/admin/site-settings', ['hero' => ['title' => 'Hi']]], ['POST', '/api/admin/images', ['photo' => 'x', 'kind' => 'hero']],
        ];
    }

    public function test_guests_are_turned_away_from_every_admin_route_before_the_database_is_asked(): void
    {
        Http::fake();
        $this->flushSession();
        foreach (self::adminRoutes() as $route) {
            $this->json($route[0], $route[1], $route[2] ?? [])->assertUnauthorized();
        }
        Http::assertNothingSent();
    }

    public function test_signed_in_people_who_are_not_administrators_get_403_and_nothing_runs(): void
    {
        $this->provider('user');
        foreach (self::adminRoutes() as $route) {
            $this->json($route[0], $route[1], $route[2] ?? [])->assertForbidden()->assertJsonPath('error', 'Only administrators can do this.');
        }
        $this->assertFalse($this->sentTo('POST /rest/v1/rpc/'));
        $this->assertFalse($this->sentTo('PUT /auth/v1/admin'));
        $this->assertFalse($this->sentTo('DELETE /auth/v1/admin'));
        $this->assertFalse($this->sentTo('PATCH '));
    }

    public function test_lists_pass_search_filters_sort_and_page_to_the_database_with_the_admin_session(): void
    {
        $this->provider(rpc: ['mt_admin_users' => ['total' => 41, 'rows' => [['id' => self::OTHER]]]]);
        $this->getJson('/api/admin/users?search=mia&role=user&status=suspended&sort=name&page=3&perPage=10')
            ->assertOk()->assertJson(['total' => 41, 'page' => 3, 'perPage' => 10, 'rows' => [['id' => self::OTHER]]]);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_admin_users')
            && $r['search_text'] === 'mia' && $r['role_filter'] === 'user' && $r['status_filter'] === 'suspended'
            && $r['sort_key'] === 'name' && $r['page_offset'] === 20 && $r['page_size'] === 10
            && $r->hasHeader('Authorization', 'Bearer admin-access'));
        $this->getJson('/api/admin/users?sort=password')->assertStatus(400);
        $this->getJson('/api/admin/users?perPage=1000')->assertStatus(400);
    }

    public function test_an_administrator_can_never_demote_suspend_reset_or_delete_their_own_account(): void
    {
        $this->provider();
        $this->postJson('/api/admin/users/'.self::ME.'/role', ['role' => 'user'])->assertStatus(409)->assertJsonPath('error', 'You cannot change your own role.');
        $this->postJson('/api/admin/users/'.self::ME.'/suspend')->assertStatus(409)->assertJsonPath('error', 'You cannot suspend your own account.');
        $this->postJson('/api/admin/users/'.self::ME.'/password')->assertStatus(409);
        $this->deleteJson('/api/admin/users/'.self::ME)->assertStatus(409)->assertJsonPath('error', 'You cannot delete your own account here.');
        $this->assertFalse($this->sentTo('POST /rest/v1/rpc/mt_admin_set_role'));
        $this->assertFalse($this->sentTo('PUT /auth/v1/admin'));
        $this->assertFalse($this->sentTo('DELETE /auth/v1/admin'));
    }

    public function test_another_administrator_must_be_demoted_before_suspension_or_deletion(): void
    {
        $this->provider(otherRole: 'admin');
        $this->postJson('/api/admin/users/'.self::OTHER.'/suspend')->assertStatus(409)->assertJsonPath('error', 'Remove administrator access from this account first.');
        $this->deleteJson('/api/admin/users/'.self::OTHER)->assertStatus(409);
        $this->assertFalse($this->sentTo('PUT /auth/v1/admin'));
        $this->assertFalse($this->sentTo('DELETE /auth/v1/admin'));
    }

    public function test_suspending_bans_the_account_ends_its_sessions_and_is_logged(): void
    {
        $this->provider();
        $this->postJson('/api/admin/users/'.self::OTHER.'/suspend')->assertOk();
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/auth/v1/admin/users/'.self::OTHER) && $r['ban_duration'] === '876000h' && $r->header('apikey')[0] === 'private-key');
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_revoke_user_sessions') && $r['target'] === self::OTHER);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_admin_log_write') && $r['action'] === 'users.suspend' && $r['summary'] === 'Suspended mia@example.test' && $r->hasHeader('Authorization', 'Bearer admin-access'));
        $this->postJson('/api/admin/users/'.self::OTHER.'/reactivate')->assertOk();
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && $r['ban_duration'] === 'none');
    }

    public function test_a_password_reset_is_shown_once_and_never_logged(): void
    {
        $this->provider();
        $password = $this->postJson('/api/admin/users/'.self::OTHER.'/password')->assertOk()->json('password');
        $this->assertMatchesRegularExpression('/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/', $password);
        Http::assertSent(fn (Request $r) => $r->method() === 'PUT' && $r['password'] === $password);
        Http::assertNotSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_admin_log_write') && str_contains(json_encode($r->data()), $password));
    }

    public function test_meetup_export_is_csv_and_spreadsheet_formulas_stay_text(): void
    {
        $this->provider(rpc: ['mt_admin_meetup_export' => [[
            'meetup_id' => 7, 'title' => '=HYPERLINK("evil")', 'starts_at' => '2026-11-01T08:00:00Z', 'price' => 15,
            'participant' => 'Mia', 'participant_email' => 'mia@example.test', 'request_status' => 'accepted',
        ]]]);
        $response = $this->get('/api/admin/meetups/export?status=live&from=2026-11-01&to=2026-11-30')->assertOk();
        $this->assertStringStartsWith('text/csv', $response->headers->get('Content-Type'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('Participant email', $csv);
        $this->assertStringContainsString("\"'=HYPERLINK(\"\"evil\"\")\"", $csv);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_admin_meetup_export') && $r['status_filter'] === 'live' && $r['from_date'] === '2026-11-01');
        $this->get('/api/admin/meetups/export?from=2026-11-30&to=2026-11-01')->assertStatus(400);
    }

    public function test_site_settings_are_public_to_read_and_checked_before_an_administrator_saves_them(): void
    {
        $this->provider();
        $this->getJson('/api/site')->assertOk()->assertJsonPath('hero.title', 'Bonjour')->assertJsonPath('announcement.enabled', false)->assertJsonPath('contact.email', null);
        $this->postJson('/api/admin/site-settings', ['announcement' => ['enabled' => true]])->assertStatus(400)->assertJsonPath('error', 'Write the announcement before turning it on.');
        $this->postJson('/api/admin/site-settings', ['social' => ['instagram' => 'javascript:alert(1)']])->assertStatus(400);
        $this->postJson('/api/admin/site-settings', ['announcement' => ['enabled' => true, 'text' => 'Carnival week!', 'link' => 'javascript:alert(1)']])->assertStatus(400);
        $this->assertFalse($this->sentTo('PATCH '));
        $this->postJson('/api/admin/site-settings', ['hero' => ['title' => '  Martinique, slowly  ', 'unknown' => 'x'], 'contact' => ['phone' => '+596 696 00 00 00'], 'announcement' => ['enabled' => true, 'text' => 'Carnival week!', 'link' => '#about']])
            ->assertOk()->assertJsonPath('hero.title', 'Martinique, slowly')->assertJsonMissingPath('hero.unknown');
        Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && $r['content']['announcement']['text'] === 'Carnival week!' && $r->hasHeader('Authorization', 'Bearer admin-access'));
    }

    public function test_contact_messages_are_validated_and_stored_with_the_server_key(): void
    {
        $this->provider();
        $this->flushSession();
        $message = ['name' => 'Gus', 'email' => 'Gus@Example.test', 'subject' => 'Opening hours', 'message' => 'Is the distillery open on Sunday?'];
        $this->postJson('/api/contact', [...$message, 'message' => 'Hi'])->assertStatus(400)->assertJsonPath('error', 'Write a message of at least 10 characters.');
        $this->postJson('/api/contact', [...$message, 'website' => 'spam.example'])->assertStatus(400);
        $this->assertFalse($this->sentTo('POST /rest/v1/mt_contact_messages'));
        $this->postJson('/api/contact', $message)->assertCreated();
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/mt_contact_messages') && $r['email'] === 'gus@example.test' && $r['user_id'] === null && $r->header('apikey')[0] === 'private-key');
    }

    public function test_only_photo_uploads_may_send_large_bodies(): void
    {
        Http::fake();
        $this->flushSession();
        $large = ['photo' => str_repeat('a', 100000)];
        $this->postJson('/api/reviews/1/photos', $large)->assertUnauthorized();
        $this->postJson('/api/admin/images', $large)->assertUnauthorized();
        $this->postJson('/api/moderation/place-photos', $large)->assertUnauthorized();
        $this->postJson('/api/places', $large)->assertStatus(413);
        $this->postJson('/api/contact', $large)->assertStatus(413);
    }
}
