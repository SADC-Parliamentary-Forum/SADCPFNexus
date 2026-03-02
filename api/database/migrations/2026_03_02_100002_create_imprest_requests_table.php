<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('imprest_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_number')->unique();
            $table->string('budget_line');
            $table->decimal('amount_requested', 10, 2);
            $table->decimal('amount_approved', 10, 2)->nullable();
            $table->decimal('amount_liquidated', 10, 2)->nullable();
            $table->string('currency', 3)->default('USD');
            $table->date('expected_liquidation_date');
            $table->text('purpose');
            $table->text('justification')->nullable();
            $table->string('status')->default('draft'); // draft, submitted, approved, rejected, liquidated
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('liquidated_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('imprest_requests');
    }
};
