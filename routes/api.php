<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\SavedPlaceController;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

// Public reads must not write stale session data over a concurrent token refresh.
Route::withoutMiddleware([EncryptCookies::class, AddQueuedCookiesToResponse::class, StartSession::class])->group(function () {
    Route::get('health', HealthController::class);
    Route::get('places', [PlaceController::class, 'index']);
});

// Allow enough lock time for the bounded, sequential provider calls in auth flows.
Route::prefix('auth')->controller(AuthController::class)->group(function () {
    Route::get('session', 'session')->block(90, 15);
    foreach (['register', 'login', 'verify', 'resend', 'logout', 'forgot-password' => 'forgotPassword', 'reset-password' => 'resetPassword'] as $path => $method) {
        Route::post(is_int($path) ? $method : $path, $method)->block(90, 15);
    }
});
Route::middleware('auth:supabase')->group(function () {
    Route::delete('account', [AccountController::class, 'destroy'])->block(90, 15);
    Route::post('places', [PlaceController::class, 'store'])->block(90, 15);
    Route::delete('places/{id}', [PlaceController::class, 'destroy'])->block(90, 15);
    Route::controller(SavedPlaceController::class)->where(['collection' => 'favorites|revisits'])->group(function () {
        Route::get('{collection}', 'index')->block(90, 15);
        Route::post('{collection}', 'store')->block(90, 15);
        Route::delete('{collection}', 'destroy')->block(90, 15);
    });
});
