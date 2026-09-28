<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            throw new RuntimeException('This schema requires Supabase PostgreSQL, including its auth schema.');
        }
        DB::unprepared(file_get_contents(database_path('schema/supabase.sql')));
        // Laravel's migration bookkeeping also lives in Supabase's exposed schema.
        DB::statement('ALTER TABLE public.mt_migrations ENABLE ROW LEVEL SECURITY');
        DB::statement('REVOKE ALL ON public.mt_migrations FROM anon, authenticated');
    }

    public function down(): void
    {
        throw new RuntimeException('Rollback is intentionally blocked: this schema contains existing Supabase accounts and catalogue data. Restore a reviewed backup instead.');
    }
};
