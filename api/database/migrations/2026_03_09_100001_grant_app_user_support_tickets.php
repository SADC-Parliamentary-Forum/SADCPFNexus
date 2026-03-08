<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!$this->tableExists('support_tickets')) {
            return;
        }
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON support_tickets TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE support_tickets_id_seq TO app_user');
    }

    public function down(): void
    {
        // Revoking sequence/table grants requires superuser; no-op.
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
