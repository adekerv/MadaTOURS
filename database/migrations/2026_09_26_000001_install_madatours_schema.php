<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') throw new RuntimeException('This schema requires Supabase PostgreSQL, including its auth schema.');
        DB::unprepared(file_get_contents(database_path('schema/supabase.sql')));
    }

    public function down(): void
    {
        throw new RuntimeException('Rollback is intentionally blocked: this schema contains existing Supabase accounts and catalogue data. Restore a reviewed backup instead.');
    }
};
