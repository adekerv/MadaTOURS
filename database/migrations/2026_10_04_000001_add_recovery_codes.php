<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(file_get_contents(database_path('schema/recovery.sql')));
    }

    public function down(): void
    {
        throw new RuntimeException('Account recovery codes protect real accounts; back them up and remove them deliberately.');
    }
};
