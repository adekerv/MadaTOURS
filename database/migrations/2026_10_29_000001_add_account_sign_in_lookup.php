<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Adds mt_account_sign_in so a failed login can name the wrong part; recovery.sql is repeat-safe.
        DB::unprepared(file_get_contents(database_path('schema/recovery.sql')));
    }

    public function down(): void
    {
        DB::unprepared('DROP FUNCTION IF EXISTS public.mt_account_sign_in(text);');
    }
};
