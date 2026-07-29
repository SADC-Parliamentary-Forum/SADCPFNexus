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
            'audit_lookups',
            'audit_universe_entities',
            'audit_plans',
            'audit_plan_versions',
            'audit_plan_approvals',
            'audit_engagements',
            'audit_independence_declarations',
            'audit_evidence_requests',
            'audit_evidence_responses',
            'audit_workpapers',
            'audit_workpaper_review_notes',
            'audit_samples',
            'audit_observations',
            'audit_findings',
            'audit_management_responses',
            'audit_recommendations',
            'audit_corrective_actions',
            'audit_verifications',
            'audit_reports',
            'audit_report_distributions',
            'audit_external_engagements',
            'audit_external_requests',
            'audit_external_findings',
            'audit_external_access_logs',
            'audit_module_events',
            'audit_settings',
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
