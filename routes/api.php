<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\EnrichmentController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\RecurringTaskController;
use App\Http\Controllers\ReviewPhotoController;
use App\Http\Controllers\SavedPlaceController;
use App\Http\Controllers\SocialController;
use App\Http\Controllers\SubmissionController;
use App\Http\Controllers\TourController;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

// Public reads must not write stale session data over a concurrent token refresh.
Route::withoutMiddleware([EncryptCookies::class, AddQueuedCookiesToResponse::class, StartSession::class])->group(function () {
    Route::get('health', HealthController::class);
    Route::get('places', [PlaceController::class, 'index']);
    Route::get('places/{place}', [PlaceController::class, 'show'])->whereNumber('place');
    Route::get('tours', [TourController::class, 'index']);
    Route::get('daily-picks', [EnrichmentController::class, 'picks']);
    Route::get('places/{place}/community', [CommunityController::class, 'show']);
    // Vercel Cron calls with GET; the GitHub workflow uses POST. Both need the secret.
    Route::match(['get', 'post'], 'internal/tasks', RecurringTaskController::class);
});

// Allow enough lock time for the bounded, sequential provider calls in auth flows.
Route::prefix('auth')->controller(AuthController::class)->group(function () {
    Route::get('session', 'session')->block(90, 15);
    Route::get('google', 'google')->block(90, 15);
    Route::get('google/callback', 'googleCallback')->block(90, 15);
    foreach (['register', 'login', 'logout', 'recover'] as $path => $method) {
        Route::post(is_int($path) ? $method : $path, $method)->block(90, 15);
    }
});
Route::middleware('auth:supabase')->group(function () {
    Route::get('moderation/enrichment', [EnrichmentController::class, 'index'])->block(90, 15);
    Route::post('moderation/enrichment/{action}', [EnrichmentController::class, 'store'])->block(90, 15);
    Route::get('submissions', [SubmissionController::class, 'index'])->block(90, 15);
    Route::post('submissions', [SubmissionController::class, 'store'])->block(90, 15);
    Route::post('submissions/{action}', [SubmissionController::class, 'decide'])->block(90, 15);
    Route::get('social', [SocialController::class, 'index'])->block(90, 15);
    Route::post('social/{action}', [SocialController::class, 'store'])->block(90, 15);
    Route::get('places/{place}/my-review', [CommunityController::class, 'mine'])->block(90, 15);
    Route::get('moderation/community', [CommunityController::class, 'moderation'])->block(90, 15);
    Route::post('community/{action}', [CommunityController::class, 'store'])->block(90, 15);
    // Review photos are for signed-in people only; guests are turned away before any of this runs.
    Route::get('places/{place}/review-photos', [ReviewPhotoController::class, 'index'])->block(90, 15);
    Route::post('reviews/{review}/photos', [ReviewPhotoController::class, 'store'])->block(90, 15);
    Route::delete('review-photos/{photo}', [ReviewPhotoController::class, 'destroy'])->block(90, 15);
    Route::post('account/profile', [AccountController::class, 'profile'])->block(90, 15);
    Route::post('account/email', [AccountController::class, 'email'])->block(90, 15);
    Route::get('account/recovery-codes', [AccountController::class, 'recoveryStatus'])->block(90, 15);
    Route::post('account/recovery-codes', [AccountController::class, 'recoveryCodes'])->block(90, 15);
    Route::delete('account', [AccountController::class, 'destroy'])->block(90, 15);
    Route::get('moderation/tours', [TourController::class, 'manage'])->block(90, 15);
    Route::post('tours', [TourController::class, 'store'])->block(90, 15);
    Route::post('tours/{id}', [TourController::class, 'update'])->block(90, 15);
    Route::post('tours/{id}/route', [TourController::class, 'recalculate'])->block(90, 15);
    Route::delete('tours/{id}', [TourController::class, 'destroy'])->block(90, 15);
    Route::post('places', [PlaceController::class, 'store'])->block(90, 15);
    Route::delete('places/{id}', [PlaceController::class, 'destroy'])->block(90, 15);
    Route::controller(SavedPlaceController::class)->where(['collection' => 'favorites|revisits'])->group(function () {
        Route::get('{collection}', 'index')->block(90, 15);
        Route::post('{collection}', 'store')->block(90, 15);
        Route::delete('{collection}', 'destroy')->block(90, 15);
    });
});
