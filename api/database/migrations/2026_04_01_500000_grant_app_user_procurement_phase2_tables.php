<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $tables = [
        'purchase_orders',
        'purchase_order_items',
        'goods_receipt_notes',
        'goods_receipt_items',
        'invoices',
        'contracts',
    ];

    public function up(): void
    {
        foreach ($this->tables as $table) {
            if (!$this->tableExists($table)) {
                continue;
            }
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
            DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
        }
    }

    public function down(): void {}

    private function tableExists(string $table): bool
    {
        return (bool) DB::selectOne(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [$table]
        );
    }
};
