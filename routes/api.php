<?php

use App\Http\Controllers\{AccountController, AuthController, HealthController, PlaceController, SavedPlaceController};
use Illuminate\Support\Facades\Route;

Route::get('health', HealthController::class);
Route::get('places', [PlaceController::class, 'index']);
Route::prefix('auth')->controller(AuthController::class)->group(function () {
    Route::get('session', 'session')->block(15, 15);
    foreach (['register', 'login', 'verify', 'resend', 'logout', 'forgot-password' => 'forgotPassword', 'reset-password' => 'resetPassword'] as $path => $method) {
        Route::post(is_int($path) ? $method : $path, $method)->block(15, 15);
    }
});
Route::middleware('supabase.auth')->group(function () {
    Route::delete('account', [AccountController::class, 'destroy'])->block(15, 15);
    Route::post('places', [PlaceController::class, 'store'])->block(15, 15);
    Route::delete('places/{id}', [PlaceController::class, 'destroy'])->block(15, 15);
    Route::controller(SavedPlaceController::class)->where(['collection' => 'favorites|revisits'])->group(function () {
        Route::get('{collection}', 'index')->block(15, 15);
        Route::post('{collection}', 'store')->block(15, 15);
        Route::delete('{collection}', 'destroy')->block(15, 15);
    });
});
