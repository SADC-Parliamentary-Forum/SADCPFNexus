<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Consumables / Stock Register — stock movements (PRD §17.3).
 * stock-in (receipt/replenishment), stock-out (issue) and adjustments.
 * Each movement records the resulting balance snapshot for an immutable audit trail.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->foreignId('stock_item_id')->constrained('stock_items')->cascadeOnDelete();
            $table->string('type', 16);                          // in | out | adjustment
            $table->integer('quantity');                         // signed delta applied to balance
            $table->integer('balance_after');                    // balance snapshot after movement
            // Issued-to recipient (any of: user, department, free-text)
            $table->foreignId('issued_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('issued_to_department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('issued_to_other')->nullable();
            $table->decimal('unit_cost', 12, 2)->nullable();     // cost at time of movement
            $table->string('reference')->nullable();             // GRN / requisition / invoice ref
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->date('transaction_date');
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamps();

            $table->index(['tenant_id', 'stock_item_id']);
            $table->index(['tenant_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transactions');
    }
};
