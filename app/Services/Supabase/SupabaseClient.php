<?php

namespace App\Services\Supabase;

use App\Exceptions\ApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/** Transport only: repositories own queries; user requests always retain database RLS. */
class SupabaseClient
{
    public function request(string $method, string $path, array $payload = [], ?string $token = null, bool $admin = false, array $headers = []): mixed
    {
        $url = config('supabase.url');
        $key = config($admin ? 'supabase.secret_key' : 'supabase.publishable_key');
        $localTestServer = app()->environment('testing') && preg_match('#^http://127\.0\.0\.1:[0-9]+$#', $url);
        if (!$key || (!str_starts_with($url, 'https://') && !$localTestServer)) throw new ApiException(503, 'The database is not configured yet.');
        $client = Http::baseUrl($url)->acceptJson()->asJson()->connectTimeout(5)->timeout(config('supabase.timeout'))->withoutRedirecting()->withHeaders(['apikey' => $key, ...$headers]);
        // New sb_secret_* keys are API keys, not JWTs. Legacy service-role JWTs need Bearer auth.
        $bearer = $token ?? ($admin && str_starts_with($key, 'eyJ') ? $key : null);
        if ($bearer) $client = $client->withToken($bearer);
        try {
            $response = $client->send($method, $path, [$method === 'GET' ? 'query' : 'json' => $payload]);
        } catch (ConnectionException) {
            throw new ApiException(503, 'Could not reach the database. Please try again shortly.');
        }
        if (!$response->successful()) {
            $code = $response->json('code') ?? $response->json('error_code');
            if ($response->status() === 429 || str_starts_with($code ?? '', 'over_')) throw new ApiException(429, 'Too many attempts. Please wait before trying again.');
            if (str_starts_with($path, '/auth/')) {
                if ($code === 'email_not_confirmed') throw new ApiException(403, 'Verify your email before signing in.');
                if ($code === 'otp_expired') throw new ApiException(400, 'This code is invalid or has expired. Request a new code.');
                if ($code === 'same_password') throw new ApiException(400, 'Choose a different password.');
                if ($response->serverError() || $code === 'email_address_not_authorized') throw new ApiException(503, 'Email or account services are unavailable. Please contact the project owner.');
                if ($response->status() === 401 || in_array($code, ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'])) throw new ApiException(401, 'Please sign in to continue.');
                throw new ApiException(400, 'Check your email, password, or verification code and try again.');
            }
            if ($code === '42501') throw new ApiException(403, 'You do not have permission to make this change.');
            if ($code === '23503') throw new ApiException(404, 'This place is no longer available.');
            if ($code === '23505') throw new ApiException(409, 'This record already exists.');
            throw new ApiException(503, 'The database request failed. Check the Supabase setup and try again.');
        }
        return $response->json();
    }
}
