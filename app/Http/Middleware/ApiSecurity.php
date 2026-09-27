<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiSecurity
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->is('api/*')) return $next($request);
        $headers = ['Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff', 'Vary' => 'Origin'];
        $origins = [config('supabase.app_origin'), config('app.url'), ...config('supabase.allowed_origins')];
        $allowed = array_filter(array_map(fn ($value) => self::origin($value), $origins));
        $origin = $request->header('Origin');
        if ($origin && !in_array($origin, $allowed, true)) return response()->json(['error' => 'This origin is not allowed.'], 403, $headers);
        if ($origin) $headers += ['Access-Control-Allow-Origin' => $origin, 'Access-Control-Allow-Credentials' => 'true'];
        if ($request->isMethod('OPTIONS')) return response('', 204, $headers + ['Access-Control-Allow-Methods' => 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers' => 'Content-Type, X-MadaTours-Client']);
        if (!$request->isMethodSafe() && $request->header('X-MadaTours-Client') !== '1') return response()->json(['error' => 'Invalid request. Please reload and try again.'], 403, $headers);
        if (strlen($request->getContent()) > 32768) return response()->json(['error' => 'Request is too large.'], 413, $headers);
        if ($request->getContent() !== '' && $request->isJson()) {
            json_decode($request->getContent(), true);
            if (json_last_error() !== JSON_ERROR_NONE) return response()->json(['error' => 'Invalid JSON request.'], 400, $headers);
        }
        $response = $next($request);
        $response->headers->add($headers);
        return $response;
    }

    private static function origin(?string $value): ?string
    {
        $value = rtrim(trim($value ?? ''), '/');
        if ($value === 'capacitor://localhost') return $value;
        $url = parse_url($value);
        if (!$url || !in_array($url['scheme'] ?? '', ['http', 'https'], true) || empty($url['host']) || isset($url['user'], $url['pass']) || isset($url['user']) || isset($url['path']) || isset($url['query']) || isset($url['fragment'])) return null;
        return $value;
    }
}
