<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Answers API validation errors in the language the app is showing, which it sends as Accept-Language. */
class ApiLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        app()->setLocale($request->getPreferredLanguage(['en', 'fr']) ?? 'en');

        return $next($request);
    }
}
