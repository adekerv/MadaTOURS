<?php

namespace App\Repositories;

use App\Exceptions\ApiException;
use App\Services\Supabase\SupabaseClient;

class PlaceRepository
{
    public function __construct(private SupabaseClient $client) {}

    public function published(): array
    {
        // Fetch every page, including catalogues larger than Supabase's default 1,000-row limit.
        $places = [];
        $offset = 0;
        do {
            $page = $this->client->request('GET', '/rest/v1/mt_places', ['select' => '*', 'published' => 'eq.true', 'order' => 'id.asc', 'limit' => 500, 'offset' => $offset]);
            $places = array_merge($places, $page);
            $offset += count($page);
        } while (count($page) === 500);
        return $places;
    }

    public function create(array $input, string $token): array
    {
        return $this->client->request('POST', '/rest/v1/mt_places', $input + ['tags' => []], $token, headers: ['Prefer' => 'return=representation'])[0];
    }

    public function delete(int $id, string $token): void
    {
        $rows = $this->client->request('DELETE', '/rest/v1/mt_places?id=eq.'.$id, token: $token, headers: ['Prefer' => 'return=representation']);
        if (!$rows) throw new ApiException(404, 'This place could not be found.');
    }
}
