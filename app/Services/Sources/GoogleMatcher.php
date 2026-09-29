<?php

namespace App\Services\Sources;

use App\Exceptions\ApiException;
use App\Services\Supabase\SupabaseClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class GoogleMatcher
{
    public function __construct(private SupabaseClient $db) {}

    public function run(int $limit = 3): int
    {
        if (! config('enrichment.google_key')) {
            throw new ApiException(503, 'Google matching is not configured yet.');
        }
        $this->db->request('POST', '/rest/v1/rpc/mt_queue_google_matches', admin: true);
        $rows = $this->db->request('GET', '/rest/v1/mt_google_matches', ['status' => 'in.(pending,error)', 'next_check_at' => 'lte.'.now()->toIso8601String(), 'order' => 'next_check_at.asc', 'limit' => min(10, max(1, $limit))], admin: true);
        $count = 0;
        foreach ($rows as $row) {
            if (! $this->db->request('POST', '/rest/v1/rpc/mt_claim_google_request', ['daily_limit' => config('enrichment.google_daily_limit')], admin: true)) {
                break;
            }
            $this->match($row);
            $count++;
        }

        return $count;
    }

    public function match(array $row): void
    {
        $places = $this->db->request('GET', '/rest/v1/mt_places', ['id' => 'eq.'.$row['place_id'], 'select' => 'id,name,lat,lng,google_place_id,location', 'limit' => 1], admin: true);
        $place = $places[0] ?? null;
        if (! $place || $place['google_place_id']) {
            return;
        }
        $status = 'error';
        $ids = [];
        $accepted = null;
        try {
            $response = Http::withHeaders(['X-Goog-Api-Key' => config('enrichment.google_key'), 'X-Goog-FieldMask' => 'places.id,places.displayName,places.location'])->asJson()->withoutRedirecting()->connectTimeout(5)->timeout(15)->post('https://places.googleapis.com/v1/places:searchText', [
                'textQuery' => $place['name'].' '.$place['location'].' Martinique', 'languageCode' => 'fr', 'pageSize' => 3,
                'locationBias' => ['circle' => ['center' => ['latitude' => (float) $place['lat'], 'longitude' => (float) $place['lng']], 'radius' => 2000]],
            ]);
            if ($response->successful()) {
                $candidates = array_slice($response->json('places') ?? [], 0, 3);
                $ids = array_values(array_filter(array_column($candidates, 'id'), fn ($id) => is_string($id) && preg_match('/^[A-Za-z0-9_-]{10,255}$/', $id)));
                $confident = array_values(array_filter($candidates, fn ($c) => in_array($c['id'] ?? null, $ids, true) && $this->confident($place, $c)));
                $accepted = count($confident) === 1 ? $confident[0]['id'] : null;
                $status = $accepted ? 'matched' : ($ids ? 'review' : 'unmatched');
            }
        } catch (Throwable) {
            // Provider content and credentials never enter our cache or logs.
        }
        if ($accepted) {
            $this->db->request('PATCH', '/rest/v1/mt_places?id=eq.'.$place['id'].'&google_place_id=is.null', ['google_place_id' => $accepted], admin: true);
        }
        $this->db->request('PATCH', '/rest/v1/mt_google_matches?place_id=eq.'.$place['id'], ['status' => $status, 'candidate_ids' => $ids, 'attempts' => $row['attempts'] + 1, 'checked_at' => now()->toIso8601String(), 'next_check_at' => now()->addWeek()->toIso8601String()], admin: true);
    }

    public function confident(array $place, array $candidate): bool
    {
        $normalize = fn ($s) => preg_replace('/[^a-z0-9]/', '', strtolower(Str::ascii($s)));
        $name = $normalize($place['name']);
        if (strlen($name) < 5 || $name !== $normalize($candidate['displayName']['text'] ?? '')) {
            return false;
        }
        $lat = $candidate['location']['latitude'] ?? null;
        $lng = $candidate['location']['longitude'] ?? null;
        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return false;
        }
        $a = sin(deg2rad($lat - $place['lat']) / 2) ** 2 + cos(deg2rad($lat)) * cos(deg2rad($place['lat'])) * sin(deg2rad($lng - $place['lng']) / 2) ** 2;

        // Deliberately conservative: ambiguous or approximate catalogue points need a human.
        return 6371000 * 2 * atan2(sqrt(min(1, $a)), sqrt(max(0, 1 - $a))) <= 350;
    }
}
