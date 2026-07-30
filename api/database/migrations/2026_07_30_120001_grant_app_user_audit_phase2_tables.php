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
            'audit_external_evidence_downloads',
            'audit_control_testing_campaigns',
            'audit_control_testing_items',
            'audit_effort_budgets',
            'audit_effort_entries',
            'audit_qa_reviews',
            'audit_donor_templates',
            'audit_engagement_template_applications',
            'audit_governance_packs',
            'audit_external_appointments',
            'audit_ai_suggestions',
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
