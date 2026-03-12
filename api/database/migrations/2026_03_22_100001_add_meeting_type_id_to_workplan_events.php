<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workplan_events', function (Blueprint $table) {
            $table->foreignId('meeting_type_id')->nullable()->after('type')
                ->constrained('meeting_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('workplan_events', function (Blueprint $table) {
            $table->dropForeign(['meeting_type_id']);
        });
    }
};
