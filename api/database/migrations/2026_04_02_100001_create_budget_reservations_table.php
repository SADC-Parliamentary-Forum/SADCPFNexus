<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_reservations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('procurement_request_id');
            $table->unsignedBigInteger('reserved_by');
            $table->string('budget_line');
            $table->decimal('reserved_amount', 15, 2);
            $table->string('currency', 3)->default('NAD');
            $table->text('notes')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->unsignedBigInteger('released_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('procurement_request_id')->references('id')->on('procurement_requests')->cascadeOnDelete();
            $table->foreign('reserved_by')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('released_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['tenant_id', 'procurement_request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_reservations');
    }
};
