<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        $tables = [
            'audit_event_types',
            'audit_event_schema_versions',
            'audit_events',
            'audit_event_changes',
            'audit_event_actors',
            'audit_event_subjects',
            'audit_event_contexts',
            'audit_event_authority_snapshots',
            'audit_event_integrity_records',
            'audit_event_checkpoints',
            'audit_event_outbox',
            'audit_event_dead_letters',
            'audit_event_holds',
            'audit_event_access_logs',
            'audit_trail_governance_decisions',
            'audit_event_alerts',
            'forensic_cases',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            // Append-only stores still need INSERT; UPDATE/DELETE blocked by PG rules on events/changes.
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void
    {
        // Grants are not revoked on down.
    }
};
