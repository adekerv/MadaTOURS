<?php

namespace App\Services\Sources;

use App\Services\Supabase\SupabaseClient;
use Throwable;

class SourceIngestion
{
    public function __construct(private SupabaseClient $db, private PublicSourceClient $http, private RobotsPolicy $robots, private StructuredPlaceData $parser) {}

    public function run(int $limit = 3): int
    {
        $sources = $this->db->request('GET', '/rest/v1/mt_source_settings', ['enabled' => 'eq.true', 'next_check_at' => 'lte.'.now()->toIso8601String(), 'order' => 'next_check_at.asc', 'limit' => min(10, max(1, $limit))], admin: true);
        // At most one page per host per invocation, plus its robots.txt.
        $hosts = [];
        $count = 0;
        foreach ($sources as $source) {
            $host = parse_url($source['url'], PHP_URL_HOST);
            if (isset($hosts[$host])) {
                continue;
            }
            $hosts[$host] = true;
            $this->ingest($source);
            $count++;
        }

        return $count;
    }

    public function ingest(array $source): void
    {
        $status = 'unavailable';
        $hoursUpdated = false;
        $photo = null;
        try {
            $url = $source['url'];
            $host = parse_url($url, PHP_URL_HOST);
            $robots = $this->http->get('https://'.$host.'/robots.txt');
            $path = (parse_url($url, PHP_URL_PATH) ?: '/').(($query = parse_url($url, PHP_URL_QUERY)) ? '?'.$query : '');
            $delay = $robots->successful() ? $this->robots->delay($robots->body()) : 0;
            if ($robots->status() !== 404 && (! $robots->successful() || ! $this->robots->allows($robots->body(), $path) || $delay > 30)) {
                $status = 'robots_denied';
            } else {
                if ($delay > 0) {
                    usleep((int) ceil($delay * 1000000));
                }
                $response = $this->http->get($url);
                if ($response->successful() && strlen($response->body()) <= 1048576 && str_contains(strtolower($response->header('Content-Type')), 'text/html')) {
                    $places = $this->db->request('GET', '/rest/v1/mt_places', ['id' => 'eq.'.$source['place_id'], 'select' => 'name', 'limit' => 1], admin: true);
                    $data = isset($places[0]) ? $this->parser->extract($response->body(), $places[0]['name']) : [];
                    $status = $data ? 'unchanged' : 'no_match';
                    if ($data['periods'] ?? []) {
                        $this->db->request('POST', '/rest/v1/rpc/mt_apply_source_hours', ['target_place' => $source['place_id'], 'periods' => $data['periods'], 'source_url' => $url], admin: true);
                        $hoursUpdated = true;
                        $status = 'updated';
                    }
                    if ($data['image'] ?? null) {
                        $this->http->validate($data['image']);
                        $photo = ['url' => $data['image'], 'license' => $data['license'], 'author' => $data['author'], 'source' => $url];
                    }
                }
            }
        } catch (Throwable) {
            // Never persist remote HTML, API credentials, stack traces or arbitrary upstream errors.
            $status = 'unavailable';
        }
        $this->db->request('PATCH', '/rest/v1/mt_source_settings?place_id=eq.'.$source['place_id'], [
            'checked_at' => now()->toIso8601String(), 'next_check_at' => now()->addWeek()->toIso8601String(),
            'candidate_photo' => $photo,
        ], admin: true);
        $this->db->request('POST', '/rest/v1/mt_source_logs', ['place_id' => $source['place_id'], 'status' => $status, 'hours_updated' => $hoursUpdated, 'photo_found' => $photo !== null], admin: true);
        $this->db->request('DELETE', '/rest/v1/mt_source_logs?created_at=lt.'.rawurlencode(now()->subDays(90)->toIso8601String()), admin: true);
    }
}
