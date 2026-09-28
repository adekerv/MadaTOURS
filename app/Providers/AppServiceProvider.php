<?php

namespace App\Providers;

use App\Services\Supabase\AuthService;
use Illuminate\Auth\GenericUser;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(AuthService::class);
    }

    public function boot(): void
    {
        Auth::viaRequest('supabase', function () {
            $auth = app(AuthService::class);

            return $auth->token() ? new GenericUser($auth->user()) : null;
        });
        Gate::define('manage-places', fn (GenericUser $user) => $user->role === 'admin');
    }
}
