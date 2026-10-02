<?php

namespace Tests\Feature;

use App\Exceptions\ApiException;
use App\Services\SubmissionPhotos;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SubmissionPhotosTest extends TestCase
{
    public function test_uploads_are_reencoded_and_metadata_is_removed(): void
    {
        $image = imagecreatetruecolor(40, 30);
        ob_start();
        imagejpeg($image);
        $jpeg = ob_get_clean();
        imagedestroy($image);
        // A JPEG comment can carry identifying information, just like EXIF metadata.
        $metadata = 'Private GPS and photographer metadata';
        $jpeg = substr($jpeg, 0, 2)."\xff\xfe".pack('n', strlen($metadata) + 2).$metadata.substr($jpeg, 2);
        $clean = app(SubmissionPhotos::class)->sanitize(base64_encode($jpeg));
        $this->assertStringNotContainsString($metadata, $clean);
        $this->assertSame('image/jpeg', getimagesizefromstring($clean)['mime']);
        $this->assertSame([40, 30], array_slice(getimagesizefromstring($clean), 0, 2));
    }

    public function test_portrait_uploads_limit_the_longest_side(): void
    {
        $image = imagecreatetruecolor(900, 2400);
        ob_start();
        imagepng($image);
        $png = ob_get_clean();
        imagedestroy($image);
        $clean = app(SubmissionPhotos::class)->sanitize(base64_encode($png));
        $this->assertSame([600, 1600], array_slice(getimagesizefromstring($clean), 0, 2));
    }

    public function test_invalid_or_oversized_uploads_are_rejected_before_storage(): void
    {
        Http::preventStrayRequests();
        foreach (['not valid base64!', base64_encode('<svg onload="alert(1)"></svg>'), base64_encode(str_repeat('x', 2097153))] as $payload) {
            try {
                app(SubmissionPhotos::class)->sanitize($payload);
                $this->fail('Invalid upload was accepted');
            } catch (ApiException $error) {
                $this->assertSame(422, $error->status);
            }
        }
        Http::assertNothingSent();
    }

    public function test_private_or_withdrawn_submission_photos_are_not_public(): void
    {
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'supabase.url' => 'https://project.supabase.co', 'supabase.publishable_key' => 'public', 'supabase.secret_key' => 'secret']);
        Http::preventStrayRequests();
        Http::fake(['*/mt_submissions*' => Http::response([])]);
        $this->get('/photos/community/00000000-0000-4000-8000-000000000001.jpg')->assertNotFound();
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/storage/'));
    }
}
