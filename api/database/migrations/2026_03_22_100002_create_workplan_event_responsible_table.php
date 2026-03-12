<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workplan_event_responsible', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workplan_event_id')->constrained('workplan_events')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unique(['workplan_event_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workplan_event_responsible');
    }
};
