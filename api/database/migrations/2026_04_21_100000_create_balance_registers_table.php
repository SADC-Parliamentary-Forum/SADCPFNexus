<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('balance_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('module_type'); // salary_advance, imprest
            $table->foreignId('employee_id')->constrained('users');
            $table->string('source_request_type'); // morph class e.g. App\Models\SalaryAdvanceRequest
            $table->unsignedBigInteger('source_request_id');
            $table->string('reference_number')->unique(); // BCR-XXXXXXXX
            $table->decimal('approved_amount', 12, 2);
            $table->decimal('total_processed', 12, 2)->default(0);
            $table->decimal('balance', 12, 2);
            $table->decimal('installment_amount', 10, 2)->nullable();
            $table->date('recovery_start_date')->nullable();
            $table->date('estimated_payoff_date')->nullable();
            $table->string('status')->default('active'); // active, closed, disputed, locked
            $table->timestamp('period_locked_at')->nullable();
            $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->softDeletes();
            $table->timestamps();

            $table->index(['tenant_id', 'module_type', 'status']);
            $table->index(['employee_id', 'status']);
            $table->index(['source_request_type', 'source_request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('balance_registers');
    }
};
