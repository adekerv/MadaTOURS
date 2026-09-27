<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->remove(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->prepend(\App\Http\Middleware\ApiSecurity::class);
        $middleware->api(append: [
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
        ]);
        $middleware->alias(['supabase.auth' => \App\Http\Middleware\AuthenticateSupabase::class]);
        $middleware->trimStrings(except: ['password', 'token']);
        $middleware->trustProxies(at: array_filter(explode(',', getenv('TRUSTED_PROXIES') ?: '')));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->dontReport([\App\Exceptions\ApiException::class]);
        $exceptions->render(function (\Throwable $error, Request $request) {
            if (!$request->is('api/*')) return null;
            if ($error instanceof \App\Exceptions\ApiException) return response()->json(['error' => $error->getMessage()], $error->status);
            if ($error instanceof \Illuminate\Validation\ValidationException) return response()->json(['error' => collect($error->errors())->flatten()->first() ?? 'Invalid request.'], 400);
            if ($error instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) return response()->json(['error' => $error->getStatusCode() === 404 ? 'API endpoint not found.' : 'The request could not be completed.'], $error->getStatusCode());
            return response()->json(['error' => 'The service is temporarily unavailable. Please try again shortly.'], 503);
        });
        // HTTP client exceptions can contain provider payloads. Never log tokens or passwords.
        $exceptions->report(function (\Throwable $error) {
            if (request()->is('api/*')) {
                \Illuminate\Support\Facades\Log::error('API operation failed', ['exception_type' => get_class($error)]);
                return false;
            }
        });
    })->create();

// Keep the existing private local configuration; production uses injected environment variables.
if (!getenv('APP_ENV') && is_file(dirname(__DIR__).'/.env.local')) $app->loadEnvironmentFrom('.env.local');
return $app;
