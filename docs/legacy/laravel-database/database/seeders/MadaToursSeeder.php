<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Archived Laravel example. Not used by the MadaTours Node application. */
class MadaToursSeeder extends Seeder
{
    public function run(): void
    {
        // Copy the canonical src/data/places.json to this path in a separate Laravel app.
        $path = resource_path('data/madatours-places.json');
        if (!is_file($path)) {
            throw new RuntimeException('Copy the MadaTours catalogue to resources/data/madatours-places.json first.');
        }
        $places = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        foreach ($places as $place) {
            $place['tags'] = json_encode($place['tags'] ?? [], JSON_THROW_ON_ERROR);
            DB::table('places')->updateOrInsert(
                ['id' => $place['id']],
                array_merge($place, ['created_at' => now(), 'updated_at' => now()])
            );
        }
        // Accounts and admin roles must be provisioned through the Laravel app's authentication system.
    }
}
