<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * hr_vip_import_batches and hr_vip_import_files (2026_09_25_120000) were created
 * without the app_user grant that every other tenant-data table gets via a
 * dedicated migration (mirrors 2026_07_22_100000_grant_app_user_pif_documents_arrival_departures.php,
 * which grants the same literal 'app_user' role that SetRlsContext middleware
 * switches into at request time via `SET ROLE app_user`).
 * Without this, any HR VIP import request fails with SQLSTATE[42501]:
 * permission denied for table hr_vip_import_batches / hr_vip_import_files.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach (['hr_vip_import_batches', 'hr_vip_import_files'] as $table) {
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
