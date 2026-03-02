<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('salary_advance_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_number')->unique();
            $table->string('advance_type', 50); // rental, medical, school, funeral, other
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('NAD');
            $table->unsignedTinyInteger('repayment_months')->default(6);
            $table->text('purpose');
            $table->text('justification')->nullable();
            $table->string('status')->default('draft'); // draft, submitted, approved, rejected, paid
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_advance_requests');
    }
};
