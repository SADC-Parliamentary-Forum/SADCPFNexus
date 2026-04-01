<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('purchase_order_id');
            $table->unsignedBigInteger('goods_receipt_note_id')->nullable();
            $table->unsignedBigInteger('vendor_id');

            $table->string('reference_number')->unique();
            $table->string('vendor_invoice_number');
            $table->date('invoice_date');
            $table->date('due_date');
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('NAD');

            $table->string('status', 30)->default('received');
            // received | matched | approved | rejected | paid
            $table->string('match_status', 30)->default('pending');
            // pending | matched | variance
            $table->text('match_notes')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
            $table->foreign('goods_receipt_note_id')->references('id')->on('goods_receipt_notes')->nullOnDelete();
            $table->foreign('vendor_id')->references('id')->on('vendors')->cascadeOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'status']);
            $table->index(['purchase_order_id']);
        });

        // Grant permissions to app user (PostgreSQL)
        DB::statement('GRANT ALL PRIVILEGES ON TABLE invoices TO sadcpfnexus;');
        DB::statement('GRANT USAGE, SELECT ON SEQUENCE invoices_id_seq TO sadcpfnexus;');
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
