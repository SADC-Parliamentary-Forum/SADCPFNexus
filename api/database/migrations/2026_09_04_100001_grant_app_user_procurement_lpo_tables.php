<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The LPO automation tables (2026_09_04_100000) were created without the
 * app_user GRANT that SetRlsContext needs. Authenticated PO detail loads
 * project / sourceIntake.lines / serviceConfirmations and 500s with
 * SQLSTATE[42501] unless these privileges exist.
 *
 * Mirrors 2026_07_22_100000_grant_app_user_pif_documents_arrival_departures.php.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ([
            'procurement_projects',
            'procurement_document_intakes',
            'procurement_document_intake_lines',
            'procurement_exceptions',
            'service_confirmations',
            'purchase_order_revisions',
            'procurement_inbox_messages',
        ] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void
    {
        // Intentionally left blank — revoking grants breaks authenticated reads.
    }
};
