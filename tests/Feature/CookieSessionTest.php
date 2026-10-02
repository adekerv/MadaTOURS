<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Vercel keeps sessions in cookies; browsers drop cookies over 4096 bytes. */
class CookieSessionTest extends TestCase
{
    public function test_a_signed_in_session_fits_in_one_browser_cookie(): void
    {
        // Mirrors api/index.php: the cookie layer encrypts once, the session layer does not.
        config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'session.driver' => 'cookie', 'session.encrypt' => false]);
        Route::middleware('api')->get('/api/test-session', function () {
            // Generous upper bound for a Supabase access token with metadata.
            session()->put('supabase', ['access_token' => Str::random(1600), 'refresh_token' => Str::random(40), 'expires_at' => time() + 3600]);

            return response()->json(['ok' => true]);
        });
        $response = $this->getJson('/api/test-session')->assertOk();
        $sizes = array_map(fn ($cookie) => strlen($cookie->getName().'='.$cookie->getValue()), $response->headers->getCookies());
        $this->assertLessThan(4000, max($sizes));
    }
}
