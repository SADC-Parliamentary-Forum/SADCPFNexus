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
            'workflow_definition_versions',
            'workflow_approval_packages',
            'workflow_tasks',
            'workflow_decisions',
            'workflow_release_events',
            'workflow_escalations',
            'workflow_certificates',
            'workflow_audit_events',
            'workflow_idempotency_keys',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void
    {
        // Grants are not revoked on down.
    }
};
