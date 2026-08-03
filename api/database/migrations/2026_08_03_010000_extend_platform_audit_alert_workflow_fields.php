<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_event_alerts', function (Blueprint $table) {
            if (! Schema::hasColumn('audit_event_alerts', 'assigned_to')) {
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('audit_event_alerts', 'assigned_at')) {
                $table->timestamp('assigned_at')->nullable();
            }
            if (! Schema::hasColumn('audit_event_alerts', 'last_detected_at')) {
                $table->timestamp('last_detected_at')->nullable();
            }
            if (! Schema::hasColumn('audit_event_alerts', 'incident_id')) {
                $table->string('incident_id', 128)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('audit_event_alerts', function (Blueprint $table) {
            if (Schema::hasColumn('audit_event_alerts', 'assigned_to')) {
                $table->dropConstrainedForeignId('assigned_to');
            }
            foreach (['assigned_at', 'last_detected_at', 'incident_id'] as $column) {
                if (Schema::hasColumn('audit_event_alerts', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
