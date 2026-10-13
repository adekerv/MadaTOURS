<?php

namespace App\Services\Supabase;

use App\Exceptions\ApiException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Supabase Storage with the service role. Only the server writes files; buckets decide who may read them.
 */
class StorageClient
{
    public function request(): PendingRequest
    {
        $url = config('supabase.url');
        $key = config('supabase.secret_key');
        $localTestServer = app()->environment('testing') && preg_match('#^http://127\.0\.0\.1:[0-9]+$#', $url);
        if ((! str_starts_with($url, 'https://') && ! $localTestServer) || ! $key) {
            throw new ApiException(503, 'Photo storage is not configured yet.');
        }
        $request = Http::baseUrl($url.'/storage/v1')->withHeaders(['apikey' => $key])->withoutRedirecting()->timeout(15)->connectTimeout(5);

        return str_starts_with($key, 'eyJ') ? $request->withToken($key) : $request;
    }

    /** The address of a file in a public bucket. */
    public function publicUrl(string $bucket, string $path): string
    {
        return rtrim((string) config('supabase.url'), '/').'/storage/v1/object/public/'.$bucket.'/'.$path;
    }
}
