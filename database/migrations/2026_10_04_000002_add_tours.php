<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(file_get_contents(database_path('schema/tours.sql')));
    }

    public function down(): void
    {
        throw new RuntimeException('Back up tours and their stored routes before explicitly removing this schema.');
    }
};
