<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_items', 'barcode')) {
                $table->string('barcode', 128)->nullable()->after('item_code');
                $table->unique(['tenant_id', 'barcode'], 'stock_items_tenant_barcode_unique');
            }
        });

        Schema::table('stocktake_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('stocktake_lines', 'client_line_key')) {
                $table->string('client_line_key', 64)->nullable()->after('notes');
                $table->index(['stocktake_id', 'client_line_key'], 'stocktake_lines_client_key_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stocktake_lines', function (Blueprint $table) {
            if (Schema::hasColumn('stocktake_lines', 'client_line_key')) {
                $table->dropIndex('stocktake_lines_client_key_idx');
                $table->dropColumn('client_line_key');
            }
        });

        Schema::table('stock_items', function (Blueprint $table) {
            if (Schema::hasColumn('stock_items', 'barcode')) {
                $table->dropUnique('stock_items_tenant_barcode_unique');
                $table->dropColumn('barcode');
            }
        });
    }
};
