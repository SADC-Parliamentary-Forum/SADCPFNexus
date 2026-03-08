<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            $table->foreignId('workplan_event_id')->nullable()->after('justification')
                ->constrained('workplan_events')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('travel_requests', function (Blueprint $table) {
            $table->dropForeign(['workplan_event_id']);
        });
    }
};
