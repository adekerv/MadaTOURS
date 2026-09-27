<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function __invoke(SupabaseClient $client): JsonResponse
    {
        $rows = $client->request('GET', '/rest/v1/mt_metadata', ['select' => 'value', 'key' => 'eq.schema_version']);
        if (($rows[0]['value'] ?? null) !== '1') throw new ApiException(503, 'The database has not been initialized.');
        return response()->json(['status' => 'ok', 'database' => 'supabase', 'framework' => 'laravel']);
    }
}
