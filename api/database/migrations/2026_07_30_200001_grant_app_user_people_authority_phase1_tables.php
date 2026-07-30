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
            'people',
            'person_confidential_profiles',
            'person_user_links',
            'employment_records',
            'organisational_units',
            'organisational_unit_versions',
            'position_versions',
            'position_assignments',
            'reporting_relationships',
            'job_descriptions',
            'job_description_versions',
            'user_role_assignments',
            'authority_definitions',
            'authority_assignments',
            'authority_snapshots',
            'acting_appointments',
            'identity_delegations',
            'identity_delegation_scopes',
            'signature_enrolments',
            'document_signature_events',
            'profile_change_requests',
            'access_review_campaigns',
            'access_review_items',
            'onboarding_cases',
            'offboarding_cases',
            'transfer_cases',
            'person_documents',
            'identity_audit_events',
            'people_authority_sod_rules',
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
