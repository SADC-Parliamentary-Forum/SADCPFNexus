<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->foreignId('purchase_order_id')->nullable()->after('tenant_id')
                ->constrained('purchase_orders')->nullOnDelete();
            $table->foreignId('procurement_request_id')->nullable()->after('purchase_order_id')
                ->constrained('procurement_requests')->nullOnDelete();
            $table->foreignId('goods_receipt_note_id')->nullable()->after('procurement_request_id')
                ->constrained('goods_receipt_notes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('goods_receipt_note_id');
            $table->dropConstrainedForeignId('procurement_request_id');
            $table->dropConstrainedForeignId('purchase_order_id');
        });
    }
};
