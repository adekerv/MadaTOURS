<?php

namespace App\Http\Middleware;

use App\Services\Supabase\AuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateSupabase
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = app(AuthService::class)->user();
        $request->attributes->set('account', $user);
        return $next($request);
    }
}
