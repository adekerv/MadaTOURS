<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(file_get_contents(database_path('schema/social.sql')));
    }

    public function down(): void
    {
        throw new RuntimeException('Social data must be backed up and removed explicitly.');
    }
};
