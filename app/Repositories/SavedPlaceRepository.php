<?php

namespace App\Repositories;

use App\Exceptions\ApiException;
use App\Services\Supabase\SupabaseClient;

class SavedPlaceRepository
{
    public function __construct(private SupabaseClient $client) {}

    public function list(string $user, string $kind, string $token): array
    {
        $places = [];
        $offset = 0;
        do {
            $page = $this->client->request('GET', '/rest/v1/mt_saved_places', ['select' => 'place_id,place:mt_places(*)', 'user_id' => 'eq.'.$user, 'kind' => 'eq.'.$kind, 'order' => 'created_at.asc,place_id.asc', 'limit' => 500, 'offset' => $offset], $token);
            foreach ($page as $row) {
                // A place that was later hidden stays in the list as a placeholder, so the person can see and remove it.
                $places[] = $row['place'] ?: ['id' => (int) $row['place_id'], 'unlisted' => true];
            }
            $offset += count($page);
        } while (count($page) === 500);

        return $places;
    }

    public function save(string $user, string $kind, int $id, string $token): void
    {
        $place = $this->client->request('GET', '/rest/v1/mt_places', ['select' => 'id', 'id' => 'eq.'.$id, 'published' => 'eq.true'], $token);
        if (! $place) {
            throw new ApiException(404, 'This place is no longer available.');
        }
        $this->client->request('POST', '/rest/v1/mt_saved_places?on_conflict=user_id,place_id,kind', ['user_id' => $user, 'place_id' => $id, 'kind' => $kind], $token, headers: ['Prefer' => 'resolution=ignore-duplicates']);
    }

    public function remove(string $user, string $kind, int $id, string $token): void
    {
        $query = http_build_query(['user_id' => 'eq.'.$user, 'kind' => 'eq.'.$kind, 'place_id' => 'eq.'.$id]);
        $this->client->request('DELETE', '/rest/v1/mt_saved_places?'.$query, token: $token);
    }
}
