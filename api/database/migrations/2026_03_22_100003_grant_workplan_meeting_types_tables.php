<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $tenantTables = ['meeting_types'];
        foreach ($tenantTables as $table) {
            $this->grantIfExists($table);
            $this->enableRlsIfExists($table);
            $this->createTenantPolicyIfNotExists($table);
        }
        $childTables = ['workplan_event_responsible'];
        foreach ($childTables as $table) {
            $this->grantIfExists($table);
        }
    }

    public function down(): void
    {
        foreach (['meeting_types'] as $table) {
            $this->dropPolicyIfExists($table);
            $this->disableRlsIfExists($table);
        }
    }

    private function grantIfExists(string $table): void
    {
        if (! $this->tableExists($table)) {
            return;
        }
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
    }

    private function tableExists(string $table): bool
    {
        $result = DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );

        return (bool) $result;
    }

    private function enableRlsIfExists(string $table): void
    {
        if (! $this->tableExists($table)) {
            return;
        }
        DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
    }

    private function disableRlsIfExists(string $table): void
    {
        if (! $this->tableExists($table)) {
            return;
        }
        DB::statement("ALTER TABLE {$table} DISABLE ROW LEVEL SECURITY");
    }

    private function createTenantPolicyIfNotExists(string $table): void
    {
        if (! $this->tableExists($table)) {
            return;
        }
        $policyName = 'tenant_isolation';
        $exists = DB::selectOne(
            'SELECT 1 FROM pg_policies WHERE tablename = ? AND policyname = ?',
            [$table, $policyName]
        );
        if ($exists) {
            return;
        }
        DB::statement("
            CREATE POLICY {$policyName} ON {$table}
            USING (tenant_id = current_setting('app.tenant_id', true)::bigint)
        ");
    }

    private function dropPolicyIfExists(string $table): void
    {
        if (! $this->tableExists($table)) {
            return;
        }
        DB::statement("DROP POLICY IF EXISTS tenant_isolation ON {$table}");
    }
};
