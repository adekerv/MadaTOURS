<?php

namespace Database\Migrations;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('places', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type'); // activity or restaurant
            $table->double('lat', 10, 6);
            $table->double('lng', 10, 6);
            $table->string('location');
            $table->text('description');
            $table->double('rating', 3, 2)->default(4.5);
            $table->string('hours');
            $table->text('tags'); // Stored as serialized JSON string
            $table->text('image')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('places');
    }
};
