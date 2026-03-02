<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_number')->unique();
            $table->string('leave_type'); // annual, sick, lil, special, maternity, paternity
            $table->date('start_date');
            $table->date('end_date');
            $table->integer('days_requested');
            $table->text('reason')->nullable();
            $table->string('status')->default('draft'); // draft, submitted, approved, rejected, cancelled
            $table->text('rejection_reason')->nullable();
            $table->boolean('has_lil_linking')->default(false);
            $table->decimal('lil_hours_required', 6, 1)->nullable();
            $table->decimal('lil_hours_linked', 6, 1)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('leave_lil_linkings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('leave_request_id')->constrained()->cascadeOnDelete();
            $table->string('accrual_code');
            $table->string('accrual_description');
            $table->decimal('hours', 6, 1);
            $table->date('accrual_date');
            $table->string('approved_by_name')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('leave_lil_linkings');
        Schema::dropIfExists('leave_requests');
    }
};
