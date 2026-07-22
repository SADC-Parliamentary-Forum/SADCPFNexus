<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * programme_documents and programme_arrival_departures (2026_07_21_100001 /
 * 2026_07_21_100002) were created without the app_user grant that every other
 * table gets via a dedicated migration (mirrors 2026_03_04_300001_grant_app_user_pif_workplan_tables.php,
 * which grants the same literal 'app_user' role that SetRlsContext middleware
 * switches into at request time via `SET ROLE app_user`).
 * Without this, ProgrammeService::get() eager-loading 'documents'/'arrivalDepartures'
 * fails with SQLSTATE[42501]: permission denied for table programme_documents.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach (['programme_documents', 'programme_arrival_departures'] as $table) {
            $this->grantIfExists($table);
        }
    }

    public function down(): void
    {
        // Intentionally left blank — revoking grants breaks reads/writes for other rows.
    }

    private function grantIfExists(string $table): void
    {
        if (!$this->tableExists($table)) return;
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
        DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
    }

    private function tableExists(string $table): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );
        return (bool) $result;
    }
};
