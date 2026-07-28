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
            'stock_batches',
            'stock_requests',
            'stock_request_lines',
            'stock_reservations',
            'stock_issues',
            'stock_issue_lines',
            'stock_returns',
            'stock_transfers',
            'stock_transfer_lines',
            'stock_write_offs',
            'stock_replenishment_requests',
        ];

        foreach ($tables as $table) {
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void
    {
        // no-op
    }
};
