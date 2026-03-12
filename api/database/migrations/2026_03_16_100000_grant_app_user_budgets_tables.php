<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Grant app_user access to budgets and budget_lines so staff can reference
     * budget data when using Programme Implementation and Travel Requisition forms.
     * Write operations remain protected by API authorization.
     */
    public function up(): void
    {
        foreach (['budgets', 'budget_lines'] as $table) {
            $this->grantIfExists($table);
        }
    }

    public function down(): void
    {
        foreach (['budgets', 'budget_lines'] as $table) {
            $this->revokeIfExists($table);
        }
    }

    private function grantIfExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
    }

    private function revokeIfExists(string $table): void
    {
        if (!$this->tableExists($table)) {
            return;
        }
        DB::statement("REVOKE ALL ON {$table} FROM app_user");
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
