<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_advance_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('salary_advance_request_id')->constrained('salary_advance_requests')->cascadeOnDelete();
            $table->foreignId('balance_register_id')->nullable()->constrained('balance_registers')->nullOnDelete();
            $table->string('status', 32)->default('open'); // open | resolved | cancelled
            $table->decimal('expected_amount', 14, 2)->nullable();
            $table->decimal('recovered_amount', 14, 2)->nullable();
            $table->decimal('variance_amount', 14, 2)->nullable();
            $table->string('reason', 255)->nullable();
            $table->text('resolution_notes')->nullable();
            $table->string('outcome', 64)->nullable(); // balanced | written_off | adjusted | other
            $table->foreignId('opened_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['salary_advance_request_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advance_reconciliations');
    }
};
