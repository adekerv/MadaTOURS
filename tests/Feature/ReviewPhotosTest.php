<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReviewPhotosTest extends TestCase
{
    private const PHOTO = '00000000-0000-4000-8000-0000000000aa';

    private const OWNER = 'original-user';

    /** Requests the provider double saw, in order, as "METHOD /path". */
    private array $calls = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public-key', 'supabase.secret_key' => 'private-key']);
        Http::preventStrayRequests();
        $this->withHeader('X-MadaTours-Client', '1')->withSession(['supabase' => ['access_token' => 'old-access', 'refresh_token' => 'old-refresh', 'expires_at' => time() + 3600]]);
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

    /**
     * @param  array<string, mixed>  $options  role, ownsReview, existingPhotos, photoOwner
     */
    private function provider(array $options = []): void
    {
        $this->calls = [];
        $options += ['role' => 'user', 'ownsReview' => true, 'existingPhotos' => 0, 'photoOwner' => self::OWNER];
        Http::fake(function (Request $request) use ($options) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            $this->calls[] = $request->method().' '.$path;
            if (str_ends_with($path, '/rpc/mt_check_rate_limit')) {
                return Http::response('true');
            }
            if ($path === '/auth/v1/user') {
                return Http::response(['id' => self::OWNER, 'email' => 'camille@example.test', 'user_metadata' => ['display_name' => 'Camille']]);
            }
            if (str_ends_with($path, '/mt_profiles')) {
                return Http::response([['role' => $options['role'], 'email_verified_at' => null]]);
            }
            if (str_ends_with($path, '/rpc/mt_place_review_photos')) {
                return Http::response([
                    ['id' => self::PHOTO, 'reviewId' => 7, 'path' => self::OWNER.'/'.self::PHOTO.'.jpg'],
                    ['id' => '00000000-0000-4000-8000-0000000000bb', 'reviewId' => 8, 'path' => 'someone/unsigned.jpg'],
                ]);
            }
            if (str_ends_with($path, '/rpc/mt_place_community')) {
                return Http::response(['reviews' => [['id' => 7, 'user_id' => self::OWNER, 'rating' => 5, 'body' => 'A lovely afternoon here.', 'display_name' => 'Camille', 'visits' => 1, 'moderated' => false]], 'comments' => [], 'rating' => 5, 'count' => 1]);
            }
            if (str_ends_with($path, '/mt_reviews')) {
                return Http::response($options['ownsReview'] ? [['id' => 7]] : []);
            }
            if (str_ends_with($path, '/mt_review_photos')) {
                return match ($request->method()) {
                    'GET' => str_contains($request->url(), 'review_id=') ? Http::response(array_fill(0, $options['existingPhotos'], ['id' => 'x'])) : Http::response([['id' => self::PHOTO, 'user_id' => $options['photoOwner']]]),
                    default => Http::response([]),
                };
            }
            if ($path === '/storage/v1/object/sign/mt-submissions') {
                return Http::response(array_map(fn ($p) => ['path' => $p, 'signedURL' => '/object/sign/mt-submissions/'.$p.'?token=t'], array_filter($request['paths'], fn ($p) => ! str_contains($p, 'unsigned'))));
            }
            if (str_starts_with($path, '/storage/v1/object/mt-submissions') || str_ends_with($path, '/mt_photo_deletions')) {
                return $request->method() === 'GET' ? Http::response([]) : Http::response(['Key' => 'ok']);
            }
            $this->fail('Unexpected provider request: '.$request->method().' '.$path);
        });
    }

    private function sent(string $call): bool
    {
        return in_array($call, $this->calls, true);
    }

    /** Calls that would store a photo or record one. */
    private function uploads(): array
    {
        return array_values(array_filter($this->calls, fn ($call) => str_starts_with($call, 'POST /storage/v1/object/mt-submissions/') || $call === 'POST /rest/v1/mt_review_photos'));
    }

    private function storageTouched(): bool
    {
        return (bool) array_filter($this->calls, fn ($call) => str_contains($call, '/storage/') || str_contains($call, 'mt_review_photos'));
    }

    public function test_guests_are_turned_away_from_every_review_photo_route_before_anything_is_read(): void
    {
        Http::fake();
        $this->flushSession();
        $this->getJson('/api/places/5/review-photos')->assertUnauthorized();
        $this->postJson('/api/reviews/7/photos', ['photo' => $this->jpeg()])->assertUnauthorized();
        $this->deleteJson('/api/review-photos/'.self::PHOTO)->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_the_public_community_feed_never_mentions_photos_even_when_photos_exist(): void
    {
        $this->provider();
        $this->flushSession();
        $body = $this->getJson('/api/places/5/community')->assertOk()->assertJsonCount(1, 'reviews')->getContent();
        $this->assertStringNotContainsStringIgnoringCase('photo', $body);
        $this->assertStringNotContainsString('.jpg', $body);
        $this->assertStringNotContainsString('token=', $body);
        $this->assertFalse($this->storageTouched(), 'the guest feed must not even look at photos');
        $this->assertFalse($this->sent('POST /rest/v1/rpc/mt_place_review_photos'));
    }

    public function test_signed_in_people_get_short_lived_links_and_guests_never_do(): void
    {
        $this->provider();
        $response = $this->getJson('/api/places/5/review-photos?offset=20')->assertOk();
        $response->assertExactJson(['photos' => [[
            'id' => self::PHOTO, 'reviewId' => 7,
            'url' => 'https://project.supabase.co/storage/v1/object/sign/mt-submissions/'.self::OWNER.'/'.self::PHOTO.'.jpg?token=t',
        ]]]);
        // A photo whose link could not be signed is left out rather than shown broken.
        $this->assertStringNotContainsString('unsigned', $response->getContent());
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/rpc/mt_place_review_photos') && $r['target_place'] === 5 && $r['page_offset'] === 20 && $r->hasHeader('Authorization', 'Bearer old-access'));
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/storage/v1/object/sign/mt-submissions') && $r['expiresIn'] === 300);
    }

    public function test_review_photo_listing_rejects_bad_places_and_pages(): void
    {
        $this->provider();
        $this->getJson('/api/places/abc/review-photos')->assertStatus(400);
        $this->getJson('/api/places/5/review-photos?offset=-1')->assertStatus(400);
        $this->getJson('/api/places/5/review-photos?offset=10001')->assertStatus(400);
        $this->assertFalse($this->sent('POST /rest/v1/rpc/mt_place_review_photos'));
    }

    public function test_a_photo_is_cleaned_stored_privately_and_attached_to_the_authors_own_review(): void
    {
        $this->provider();
        $response = $this->postJson('/api/reviews/7/photos', ['photo' => $this->jpeg()])->assertCreated();
        $response->assertJsonPath('photo.reviewId', 7)->assertJsonPath('photo.url', fn ($url) => str_starts_with($url, 'https://project.supabase.co/storage/v1/object/sign/mt-submissions/'.self::OWNER.'/'));
        $id = $response->json('photo.id');
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && str_contains($r->url(), '/storage/v1/object/mt-submissions/'.self::OWNER.'/'.$id.'.jpg') && getimagesizefromstring($r->body())['mime'] === 'image/jpeg');
        Http::assertSent(fn (Request $r) => $r->method() === 'POST' && str_ends_with($r->url(), '/rest/v1/mt_review_photos') && $r['review_id'] === 7 && $r['user_id'] === self::OWNER && $r['id'] === $id && $r->hasHeader('apikey', 'private-key'));
        // Ownership is proved with the person's own token, so row-level security does the check.
        Http::assertSent(fn (Request $r) => $r->method() === 'GET' && str_contains($r->url(), '/rest/v1/mt_reviews?') && str_contains($r->url(), 'user_id=eq.'.self::OWNER) && $r->hasHeader('Authorization', 'Bearer old-access'));
    }

    public function test_photos_cannot_be_added_to_someone_elses_review(): void
    {
        $this->provider(['ownsReview' => false]);
        $this->postJson('/api/reviews/7/photos', ['photo' => $this->jpeg()])->assertNotFound();
        $this->assertSame([], $this->uploads());
    }

    public function test_a_review_holds_at_most_three_photos(): void
    {
        $this->provider(['existingPhotos' => 3]);
        $this->postJson('/api/reviews/7/photos', ['photo' => $this->jpeg()])->assertStatus(422)->assertJsonPath('error', 'A review can have up to 3 photos.');
        $this->assertSame([], $this->uploads());
    }

    public function test_bad_uploads_are_refused_before_storage(): void
    {
        $this->provider();
        $this->postJson('/api/reviews/7/photos', [])->assertStatus(400);
        $this->postJson('/api/reviews/7/photos', ['photo' => base64_encode('<svg onload="alert(1)"></svg>')])->assertStatus(422);
        $this->postJson('/api/reviews/abc/photos', ['photo' => $this->jpeg()])->assertStatus(400);
        $this->assertSame([], $this->uploads());
    }

    public function test_an_author_can_remove_their_photo_and_its_file_is_queued_for_deletion(): void
    {
        $this->provider();
        $this->deleteJson('/api/review-photos/'.self::PHOTO)->assertOk()->assertExactJson(['success' => true]);
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && str_ends_with($r->url(), '/rest/v1/mt_review_photos?id=eq.'.self::PHOTO) && $r->hasHeader('apikey', 'private-key'));
        $this->assertTrue($this->sent('GET /rest/v1/mt_photo_deletions'), 'the queued file is cleaned up straight away');
    }

    public function test_someone_elses_photo_cannot_be_removed(): void
    {
        $this->provider(['photoOwner' => 'another-user']);
        $this->deleteJson('/api/review-photos/'.self::PHOTO)->assertForbidden();
        $this->assertFalse($this->sent('DELETE /rest/v1/mt_review_photos'));
    }

    public function test_an_administrator_can_remove_any_photo(): void
    {
        $this->provider(['photoOwner' => 'another-user', 'role' => 'admin']);
        $this->deleteJson('/api/review-photos/'.self::PHOTO)->assertOk();
        $this->assertTrue($this->sent('DELETE /rest/v1/mt_review_photos'));
    }

    public function test_removing_unknown_or_malformed_photo_ids_changes_nothing(): void
    {
        $this->provider();
        $this->deleteJson('/api/review-photos/not-a-uuid')->assertStatus(400);
        $this->assertFalse($this->sent('DELETE /rest/v1/mt_review_photos'));
    }
}
