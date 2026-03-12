<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->tableExists('timesheet_projects')) {
            return;
        }
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON timesheet_projects TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE timesheet_projects_id_seq TO app_user');
    }

    public function down(): void
    {
        // Revoking grants requires superuser; no-op.
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
