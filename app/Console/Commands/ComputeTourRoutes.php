<?php

namespace App\Console\Commands;

use App\Services\OpenRouteService;
use App\Services\Supabase\SupabaseClient;
use App\Services\TourRoutes;
use Illuminate\Console\Command;

class ComputeTourRoutes extends Command
{
    protected $signature = 'tours:compute-routes {--all : Work out every tour again, even those that already have a road route} {--id=* : Only these tour ids}';

    protected $description = 'Work out and store the road route of tours that have none yet (requires ORS_API_KEY)';

    public function handle(SupabaseClient $client, TourRoutes $routes, OpenRouteService $roads): int
    {
        if (! $roads->configured()) {
            $this->error('ORS_API_KEY is not set, so no road routes can be worked out. Add a free key from openrouteservice.org to .env.');

            return self::FAILURE;
        }
        $query = ['select' => '*', 'order' => 'id.asc'];
        if ($ids = array_filter(array_map('intval', (array) $this->option('id')))) {
            $query['id'] = 'in.('.implode(',', $ids).')';
        }
        $tours = collect($client->request('GET', '/rest/v1/mt_tours', $query, admin: true))
            ->filter(fn ($tour) => $this->option('all') || $ids || empty($tour['route_geojson']))
            ->values();
        if ($tours->isEmpty()) {
            $this->info('Every tour already has a road route.');

            return self::SUCCESS;
        }
        $road = $straight = 0;
        foreach ($tours as $index => $tour) {
            if ($index > 0) {
                usleep(config('services.openrouteservice.delay_ms') * 1000);
            }
            $done = $routes->refresh($tour, force: true);
            if (! empty($done['route_geojson'])) {
                $road++;
                $this->line("Tour {$tour['id']} ({$tour['name']}): road route stored, ".round($done['route_distance_m'] / 1000, 1).' km.');
            } else {
                $straight++;
                $this->warn("Tour {$tour['id']} ({$tour['name']}): no road route, so straight lines are used (see the log).");
            }
        }
        $this->info("Done: {$road} road route(s) stored, {$straight} tour(s) left with straight lines.");

        return self::SUCCESS;
    }
}
