<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->tableExists('asset_requests')) {
            return;
        }
        DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON asset_requests TO app_user');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE asset_requests_id_seq TO app_user');
    }

    public function down(): void
    {
        if (! $this->tableExists('asset_requests')) {
            return;
        }
        DB::statement('REVOKE ALL ON asset_requests FROM app_user');
        DB::statement('REVOKE ALL ON SEQUENCE asset_requests_id_seq FROM app_user');
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
