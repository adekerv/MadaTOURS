<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(file_get_contents(database_path('schema/owner-photos.sql')));
    }

    public function down(): void
    {
        throw new RuntimeException('Photo permissions are the record of what owners allowed; back them up and remove them deliberately.');
    }
};
