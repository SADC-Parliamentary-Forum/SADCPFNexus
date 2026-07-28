<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Consumables / Stock Phase 1 — UoM, locations, reason codes, GRN link, stocktakes.
 * Extends the existing stock register; does NOT touch fixed assets tables.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('stock_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::table('stock_items', function (Blueprint $table) {
            $table->foreignId('stock_unit_id')->nullable()->after('unit')->constrained('stock_units')->nullOnDelete();
            $table->foreignId('stock_location_id')->nullable()->after('storage_location')->constrained('stock_locations')->nullOnDelete();
        });

        Schema::table('stock_transactions', function (Blueprint $table) {
            $table->string('reason_code', 32)->nullable()->after('reason');
            $table->foreignId('stock_location_id')->nullable()->after('reason_code')->constrained('stock_locations')->nullOnDelete();
            $table->foreignId('goods_receipt_note_id')->nullable()->after('stock_location_id')->constrained('goods_receipt_notes')->nullOnDelete();
            $table->index(['tenant_id', 'reason_code']);
            $table->index(['tenant_id', 'transaction_date']);
        });

        Schema::create('stocktakes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 64);
            $table->string('name');
            $table->foreignId('stock_location_id')->nullable()->constrained('stock_locations')->nullOnDelete();
            $table->string('status', 32)->default('draft'); // draft | in_progress | completed | cancelled
            $table->date('count_date');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference_number']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('stocktake_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stocktake_id')->constrained('stocktakes')->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->integer('system_qty')->default(0);
            $table->integer('counted_qty')->nullable();
            $table->integer('variance')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['stocktake_id', 'stock_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stocktake_lines');
        Schema::dropIfExists('stocktakes');

        Schema::table('stock_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('goods_receipt_note_id');
            $table->dropConstrainedForeignId('stock_location_id');
            $table->dropIndex(['tenant_id', 'reason_code']);
            $table->dropIndex(['tenant_id', 'transaction_date']);
            $table->dropColumn('reason_code');
        });

        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('stock_location_id');
            $table->dropConstrainedForeignId('stock_unit_id');
        });

        Schema::dropIfExists('stock_locations');
        Schema::dropIfExists('stock_units');
    }
};
