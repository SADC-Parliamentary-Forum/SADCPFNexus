<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Consumables / Stock Register — stock items (PRD §17.2).
 * Tracks consumables (stationery, toner, cartridges, regalia, event material, etc.)
 * with running balance, reorder level, storage location and optional procurement links.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_category_id')->nullable()->constrained('stock_categories')->nullOnDelete();
            $table->string('item_code', 64);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('unit', 32)->nullable();              // each, box, ream, pack…
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->integer('current_balance')->default(0);      // quantity on hand
            $table->integer('reorder_level')->default(0);        // low-stock threshold
            $table->string('storage_location')->nullable();
            // Optional procurement linkage (supplier / request / PO)
            $table->foreignId('vendor_id')->nullable()->constrained('vendors')->nullOnDelete();
            $table->foreignId('procurement_request_id')->nullable()->constrained('procurement_requests')->nullOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->string('status', 32)->default('active');     // active | archived
            $table->text('notes')->nullable();
            $table->timestamps();
        });
        Schema::table('stock_items', fn (Blueprint $t) => $t->unique(['tenant_id', 'item_code']));
        Schema::table('stock_items', fn (Blueprint $t) => $t->index(['tenant_id', 'stock_category_id']));
        Schema::table('stock_items', fn (Blueprint $t) => $t->index(['tenant_id', 'status']));
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_items');
    }
};
