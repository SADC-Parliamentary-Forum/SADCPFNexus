<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goods_receipt_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('purchase_order_id');
            $table->string('reference_number')->unique();
            $table->unsignedBigInteger('received_by');
            $table->date('received_date');
            $table->string('delivery_note_number')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('pending'); // pending|inspected|accepted|rejected
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
            $table->foreign('received_by')->references('id')->on('users')->restrictOnDelete();

            $table->index(['tenant_id', 'purchase_order_id']);
        });

        Schema::create('goods_receipt_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('goods_receipt_note_id');
            $table->unsignedBigInteger('purchase_order_item_id');
            $table->integer('quantity_ordered')->default(0);
            $table->integer('quantity_received')->default(0);
            $table->integer('quantity_accepted')->default(0);
            $table->text('condition_notes')->nullable();
            $table->timestamps();

            $table->foreign('goods_receipt_note_id')->references('id')->on('goods_receipt_notes')->cascadeOnDelete();
            $table->foreign('purchase_order_item_id')->references('id')->on('purchase_order_items')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('goods_receipt_items');
        Schema::dropIfExists('goods_receipt_notes');
    }
};
