<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Hidden reviews changed community.sql and review-photos.sql after their first migrations; both are repeat-safe.
        foreach (['community', 'review-photos', 'admin'] as $file) {
            DB::unprepared(file_get_contents(database_path("schema/{$file}.sql")));
        }
    }

    public function down(): void
    {
        throw new RuntimeException('Back up the activity log, contact messages and site settings before explicitly removing this schema.');
    }
};
