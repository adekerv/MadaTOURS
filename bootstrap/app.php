<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\ApiSecurity;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The public React shell is stateless. A web session here would overwrite
        // the API-scoped cookie on reload because browsers do not send it to '/'.
        $middleware->web(remove: [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            PreventRequestForgery::class,
        ]);
        $middleware->redirectGuestsTo(null);
        $middleware->remove(HandleCors::class);
        $middleware->prepend(ApiSecurity::class);
        $middleware->api(append: [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
        ]);
        $middleware->trimStrings(except: ['password', 'token']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->dontReport([ApiException::class]);
        $exceptions->render(function (Throwable $error, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            if ($error instanceof ApiException) {
                return response()->json(['error' => $error->getMessage()], $error->status);
            }
            if ($error instanceof AuthenticationException) {
                return response()->json(['error' => 'Please sign in to continue.'], 401);
            }
            if ($error instanceof AuthorizationException) {
                return response()->json(['error' => 'Only administrators can manage places.'], 403);
            }
            if ($error instanceof ValidationException) {
                return response()->json(['error' => collect($error->errors())->flatten()->first() ?? 'Invalid request.'], 400);
            }
            if ($error instanceof HttpExceptionInterface) {
                return response()->json(['error' => $error->getStatusCode() === 404 ? 'API endpoint not found.' : 'The request could not be completed.'], $error->getStatusCode());
            }

            return response()->json(['error' => 'The service is temporarily unavailable. Please try again shortly.'], 503);
        });
        // HTTP client exceptions can contain provider payloads. Never log tokens or passwords.
        $exceptions->report(function (Throwable $error) {
            if (request()->is('api/*')) {
                Log::error('API operation failed', ['exception_type' => get_class($error)]);

                return false;
            }
        });
    })->create();

// Keep the existing private local configuration; production uses injected environment variables.
if (! getenv('APP_ENV') && ! is_file(dirname(__DIR__).'/.env') && is_file(dirname(__DIR__).'/.env.local')) {
    $app->loadEnvironmentFrom('.env.local');
}

return $app;
