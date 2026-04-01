<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('procurement_request_id');
            $table->unsignedBigInteger('vendor_id');
            $table->string('reference_number')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('delivery_address')->nullable();
            $table->string('payment_terms')->default('net_30'); // net_30|net_60|on_delivery
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->string('status', 30)->default('draft'); // draft|issued|partially_received|received|invoiced|closed|cancelled
            $table->timestamp('issued_at')->nullable();
            $table->date('expected_delivery_date')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('issued_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('procurement_request_id')->references('id')->on('procurement_requests')->cascadeOnDelete();
            $table->foreign('vendor_id')->references('id')->on('vendors')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('issued_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_order_id');
            $table->unsignedBigInteger('procurement_item_id')->nullable();
            $table->string('description');
            $table->integer('quantity')->default(1);
            $table->string('unit', 50)->default('unit');
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('total_price', 15, 2)->default(0);
            $table->timestamps();

            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
            $table->foreign('procurement_item_id')->references('id')->on('procurement_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
    }
};
