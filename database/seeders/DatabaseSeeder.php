<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') throw new \RuntimeException('Use a Supabase PostgreSQL connection for catalogue seeding.');
        DB::transaction(function () {
            DB::select('SELECT pg_advisory_xact_lock(23092026)');
            if (DB::table('mt_metadata')->where('key', 'catalogue_seeded')->exists()) {
                $this->command?->info('Catalogue already seeded; existing edits and deletions preserved.');
                return;
            }
            $places = json_decode(file_get_contents(database_path('data/places.json')), true, flags: JSON_THROW_ON_ERROR);
            foreach (array_chunk($places, 100) as $chunk) {
                $rows = array_map(function ($place) {
                    $row = array_intersect_key($place, array_flip(['id', 'name', 'type', 'lat', 'lng', 'location', 'description', 'description_fr', 'rating', 'hours', 'tags', 'image', 'photo_credit', 'sources', 'access', 'published']));
                    $row += ['description_fr' => null, 'rating' => null, 'hours' => null, 'tags' => [], 'image' => null, 'photo_credit' => null, 'sources' => [], 'access' => 'unknown', 'published' => true];
                    foreach (['tags', 'photo_credit', 'sources'] as $key) if ($row[$key] !== null) $row[$key] = json_encode($row[$key], JSON_THROW_ON_ERROR);
                    ksort($row);
                    return $row;
                }, $chunk);
                DB::table('mt_places')->insertOrIgnore($rows);
            }
            DB::select("SELECT setval(pg_get_serial_sequence('public.mt_places','id'), GREATEST(COALESCE((SELECT max(id) FROM public.mt_places),1),(SELECT last_value FROM public.mt_places_id_seq)),true)");
            DB::table('mt_metadata')->insert(['key' => 'catalogue_seeded', 'value' => '1']);
        });
    }
}
