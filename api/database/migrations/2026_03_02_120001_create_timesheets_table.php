<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('timesheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('week_start');
            $table->date('week_end');
            $table->decimal('total_hours', 5, 2)->default(0);
            $table->decimal('overtime_hours', 5, 2)->default(0);
            $table->string('status')->default('draft'); // draft, submitted, approved, rejected
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('timesheet_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('timesheet_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->decimal('hours', 4, 2);
            $table->decimal('overtime_hours', 4, 2)->default(0);
            $table->string('description', 500)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timesheet_entries');
        Schema::dropIfExists('timesheets');
    }
};
