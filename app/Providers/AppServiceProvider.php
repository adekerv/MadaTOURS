<?php

namespace App\Providers;

use App\Services\Supabase\AuthService;
use Illuminate\Auth\GenericUser;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(AuthService::class);
    }

    public function boot(): void
    {
        if ($this->app->environment('testing')) {
            // Browser tests must use the built assets, even while a developer runs Vite.
            // Do not delete or modify their shared public/hot file.
            Vite::useHotFile(storage_path('framework/testing-vite.hot'));
        }

        Auth::viaRequest('supabase', function () {
            $auth = app(AuthService::class);

            return $auth->token() ? new GenericUser($auth->user()) : null;
        });
        Gate::define('manage-places', fn (GenericUser $user) => $user->role === 'admin');
    }
}
