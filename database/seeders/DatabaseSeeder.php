<?php

namespace Database\Seeders;

use App\Support\CatalogueSeed;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(CatalogueSeed $seed): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            throw new \RuntimeException('Use a Supabase PostgreSQL connection for catalogue seeding.');
        }
        DB::transaction(fn () => DB::unprepared($seed->sql()));
        $this->command?->info('Catalogue seeded once; existing edits and deletions preserved.');
    }
}
