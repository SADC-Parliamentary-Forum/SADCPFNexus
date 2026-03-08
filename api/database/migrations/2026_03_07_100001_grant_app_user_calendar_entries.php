<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Grant app_user access to calendar_entries and enable RLS (tenant-scoped).
     */
    public function up(): void
    {
        if (!$this->tableExists('calendar_entries')) {
            return;
        }
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_entries TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE calendar_entries_id_seq TO app_user');
        DB::statement('ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY');

        $exists = DB::selectOne(
            "SELECT 1 FROM pg_policies WHERE tablename = 'calendar_entries' AND policyname = 'tenant_isolation'"
        );
        if (!$exists) {
            DB::statement("
                CREATE POLICY tenant_isolation ON calendar_entries
                USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
            ");
        }
    }

    public function down(): void
    {
        if (!$this->tableExists('calendar_entries')) {
            return;
        }
        DB::statement('DROP POLICY IF EXISTS tenant_isolation ON calendar_entries');
        DB::statement('ALTER TABLE calendar_entries DISABLE ROW LEVEL SECURITY');
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
