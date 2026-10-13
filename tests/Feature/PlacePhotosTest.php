<?php

namespace Tests\Feature;

use App\Services\PlacePhotos;
use App\Services\Sources\PublicSourceClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PlacePhotosTest extends TestCase
{
    private const ADMIN = '00000000-0000-4000-8000-00000000000a';

    private const PERMISSION = '00000000-0000-4000-8000-0000000000cc';

    private const PUBLIC = 'https://project.supabase.co/storage/v1/object/public/mt-place-photos/';

    /** Requests the provider double saw, in order, as "METHOD /path". */
    private array $calls = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
        $this->withHeader('X-MadaTours-Client', '1')->withSession(['supabase' => ['access_token' => 'admin-access', 'refresh_token' => 'admin-refresh', 'expires_at' => time() + 3600]]);
    }

    private function jpeg(): string
    {
        $image = imagecreatetruecolor(40, 30);
        ob_start();
        imagejpeg($image);
        $jpeg = ob_get_clean();
        imagedestroy($image);

        return base64_encode($jpeg);
    }

    /** @param array<string, mixed> $options role, placeImage, permission, previous, candidatePhoto, sourceImage */
    private function provider(array $options = []): void
    {
        $this->calls = [];
        $options += ['role' => 'admin', 'placeImage' => null, 'permission' => null, 'previous' => [], 'candidatePhoto' => null, 'sourceImage' => null];
        Http::fake(function (Request $request) use ($options) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            $this->calls[] = $request->method().' '.$path;
            if ($request->url() === 'https://venue.example/photo.jpg') {
                return Http::response($options['sourceImage'], 200, ['Content-Type' => 'image/jpeg']);
            }
            if (str_ends_with($path, '/rpc/mt_check_rate_limit')) {
                return Http::response('true');
            }
            if ($path === '/auth/v1/user') {
                return Http::response(['id' => self::ADMIN, 'email' => 'admin@example.test', 'user_metadata' => ['display_name' => 'Admin']]);
            }
            if (str_ends_with($path, '/mt_profiles')) {
                return Http::response([['role' => $options['role'], 'email_verified_at' => null]]);
            }
            if (str_ends_with($path, '/mt_places')) {
                return $request->method() === 'GET' ? Http::response([['id' => 5, 'image' => $options['placeImage']]]) : Http::response([]);
            }
            if (str_ends_with($path, '/mt_photo_permissions')) {
                if ($request->method() !== 'GET') {
                    return Http::response([]);
                }

                return preg_match('/[?&]id=eq\./', $request->url()) ? Http::response($options['permission'] ? [$options['permission']] : []) : Http::response($options['previous']);
            }
            if (str_ends_with($path, '/mt_source_settings')) {
                return Http::response($request->method() === 'GET' ? [['place_id' => 5, 'candidate_photo' => $options['candidatePhoto']]] : []);
            }
            if (str_ends_with($path, '/mt_photo_reports') || str_ends_with($path, '/mt_source_logs')) {
                return Http::response([]);
            }
            if (str_starts_with($path, '/storage/v1/object/')) {
                return Http::response(['Key' => 'ok']);
            }
            $this->fail('Unexpected provider request: '.$request->method().' '.$path);
        });
    }

    private function upload(array $overrides = []): array
    {
        return $overrides + [
            'placeId' => 5, 'photo' => $this->jpeg(), 'evidence' => base64_encode('%PDF-1.4 signed permission'),
            'grantorName' => 'Marie Joseph', 'grantorRole' => 'Owner', 'business' => 'Le Petibonum',
            'licenceVersion' => 'MadaTours photo licence v1', 'channel' => 'email', 'grantedOn' => '2026-10-01',
            'expiresOn' => '2027-10-01', 'credit' => 'Le Petibonum', 'sourceUrl' => 'https://petibonum.com/', 'confirmed' => true,
        ];
    }

    public function test_an_owner_photo_is_self_hosted_with_its_permission_recorded_and_credited_as_permission(): void
    {
        $this->provider();

        $response = $this->postJson('/api/moderation/place-photos', $this->upload())->assertCreated();

        $image = $response->json('image');
        $this->assertMatchesRegularExpression('#^'.preg_quote(self::PUBLIC, '#').'places/5-[0-9a-f-]{36}\.jpg$#', $image);
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && str_starts_with($r->url(), 'https://project.supabase.co/storage/v1/object/mt-place-photos/places/5-'));
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && preg_match('#/storage/v1/object/mt-photo-evidence/evidence/[0-9a-f-]{36}\.pdf$#', $r->url()));
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rest/v1/mt_photo_permissions') && $r->method() === 'POST'
            && $r['basis'] === 'permission' && $r['grantor_name'] === 'Marie Joseph' && $r['channel'] === 'email'
            && $r['recorded_by'] === self::ADMIN && preg_match('/^[0-9a-f]{64}$/', $r['file_sha256']) && $r['expires_on'] === '2027-10-01');
        Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && str_contains($r->url(), '/rest/v1/mt_places?id=eq.5')
            && $r['image'] === $image && $r['photo_credit']['basis'] === 'permission' && $r['photo_credit']['author'] === 'Le Petibonum');
    }

    public function test_only_administrators_may_publish_or_revoke_owner_photos(): void
    {
        $this->provider(['role' => 'user']);

        $this->postJson('/api/moderation/place-photos', $this->upload())->assertForbidden();
        $this->postJson('/api/moderation/place-photos/revoke', ['id' => self::PERMISSION])->assertForbidden();

        $this->assertEmpty(array_filter($this->calls, fn ($call) => str_contains($call, '/storage/') || str_contains($call, 'mt_photo_permissions')));
    }

    public function test_an_owner_photo_needs_confirmed_permission_and_real_evidence(): void
    {
        $this->provider();

        $this->postJson('/api/moderation/place-photos', $this->upload(['confirmed' => false]))->assertStatus(400);
        $this->postJson('/api/moderation/place-photos', $this->upload(['evidence' => base64_encode('<html>not a document</html>')]))->assertStatus(422);
        $this->postJson('/api/moderation/place-photos', $this->upload(['channel' => 'rumour']))->assertStatus(400);

        $this->assertEmpty(array_filter($this->calls, fn ($call) => str_starts_with($call, 'POST /storage/')));
    }

    public function test_a_newer_photo_replaces_the_older_one_and_its_file(): void
    {
        $this->provider(['previous' => [['id' => self::PERMISSION, 'image_path' => 'places/5-11111111-1111-4111-8111-111111111111.jpg']]]);

        $this->postJson('/api/moderation/place-photos', $this->upload())->assertCreated();

        Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && str_contains($r->url(), 'mt_photo_permissions?id=eq.'.self::PERMISSION) && isset($r['revoked_at']));
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && str_ends_with($r->url(), '/object/mt-place-photos') && $r['prefixes'] === ['places/5-11111111-1111-4111-8111-111111111111.jpg']);
    }

    public function test_revoking_takes_down_only_the_photo_that_permission_covers(): void
    {
        $file = 'places/5-22222222-2222-4222-8222-222222222222.jpg';
        $this->provider(['permission' => ['id' => self::PERMISSION, 'place_id' => 5, 'image_path' => $file, 'revoked_at' => null]]);

        $this->postJson('/api/moderation/place-photos/revoke', ['id' => self::PERMISSION])->assertOk();

        Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && str_contains($r->url(), 'mt_places?id=eq.5&image=eq.'.rawurlencode(self::PUBLIC.$file)) && $r['image'] === null && $r['photo_credit'] === null);
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && $r['prefixes'] === [$file]);
    }

    public function test_expired_permissions_are_taken_down_by_the_daily_task(): void
    {
        $file = 'places/5-33333333-3333-4333-8333-333333333333.jpg';
        $this->provider(['previous' => [['id' => self::PERMISSION]], 'permission' => ['id' => self::PERMISSION, 'place_id' => 5, 'image_path' => $file, 'revoked_at' => null]]);

        $count = app(PlacePhotos::class)->expire();

        $this->assertSame(1, $count);
        Http::assertSent(fn (Request $r) => $r->method() === 'GET' && str_contains($r->url(), 'mt_photo_permissions') && str_contains(urldecode($r->url()), 'expires_on=lt.'.now()->toDateString()));
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && $r['prefixes'] === [$file]);
    }

    public function test_anyone_can_report_the_photo_they_saw_but_not_an_arbitrary_address(): void
    {
        $this->provider(['placeImage' => '/photos/5-montagne-pelee.webp']);
        $this->flushSession();

        $this->postJson('/api/photo-reports', ['placeId' => 5, 'image' => '/photos/5-montagne-pelee.webp', 'reason' => 'not_this_place', 'details' => 'This is the Pitons.'])->assertCreated();
        $this->postJson('/api/photo-reports', ['placeId' => 5, 'image' => '/assets/placeholders/diving-1-v1.webp', 'reason' => 'privacy'])->assertCreated();
        $this->postJson('/api/photo-reports', ['placeId' => 5, 'image' => 'https://elsewhere.example/x.jpg', 'reason' => 'copyright'])->assertStatus(422);
        $this->postJson('/api/photo-reports', ['placeId' => 5, 'image' => '/photos/5-montagne-pelee.webp', 'reason' => 'spam'])->assertStatus(400);

        $reports = Http::recorded(fn (Request $r) => $r->method() === 'POST' && str_ends_with($r->url(), '/mt_photo_reports'));
        $this->assertCount(2, $reports);
        $this->assertSame('not_this_place', $reports->first()[0]['reason']);
    }

    public function test_approving_a_source_photo_self_hosts_it_and_records_who_vouched_for_it(): void
    {
        $this->provider(['candidatePhoto' => ['url' => 'https://venue.example/photo.jpg', 'source' => 'https://venue.example/'], 'sourceImage' => base64_decode($this->jpeg())]);
        $this->app->bind(PublicSourceClient::class, fn () => new class extends PublicSourceClient
        {
            public function addresses(string $host): array
            {
                return ['93.184.215.14'];
            }
        });

        $this->postJson('/api/moderation/enrichment/photo', ['placeId' => 5, 'rights' => true, 'author' => 'Venue', 'license' => 'CC BY 4.0', 'licenseUrl' => 'https://creativecommons.org/licenses/by/4.0/'])->assertOk();

        Http::assertNotSent(fn (Request $r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_places?') && ($r['image'] ?? null) === 'https://venue.example/photo.jpg');
        Http::assertSent(fn (Request $r) => $r->method() === 'PATCH' && str_contains($r->url(), '/mt_places?id=eq.5') && str_starts_with((string) $r['image'], self::PUBLIC.'places/5-'));
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && str_ends_with($r->url(), '/mt_photo_permissions') && $r['basis'] === 'attestation' && $r['recorded_by'] === self::ADMIN && $r['channel'] === 'source_site');
    }
}
