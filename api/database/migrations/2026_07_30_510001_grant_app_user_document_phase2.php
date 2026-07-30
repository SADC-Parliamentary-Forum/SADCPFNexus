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
            'managed_documents',
            'document_versions',
            'document_download_tokens',
            'document_audit_events',
            'document_file_objects',
            'document_links',
            'document_upload_sessions',
            'document_external_shares',
            'document_derivatives',
            'document_ocr_jobs',
            'document_retention_campaigns',
            'document_disposal_requests',
            'document_governance_decisions',
            'correspondence',
            'audit_workpapers',
            'audit_evidence_responses',
            'attachments',
        ];

        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            try {
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            } catch (\Throwable) {
            }
        }
    }

    public function down(): void
    {
    }
};
