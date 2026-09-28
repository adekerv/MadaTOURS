<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(file_get_contents(database_path('schema/query-indexes.sql')));
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS public.mt_saved_places_user_kind_created_idx');
        DB::statement('DROP INDEX IF EXISTS public.mt_places_published_id_idx');
        DB::statement('DROP INDEX IF EXISTS public.mt_rate_limits_expires_idx');
    }
};
