<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('work_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_to')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('priority', 16)->default('medium'); // low, medium, high, critical
            $table->string('status', 32)->default('assigned'); // draft, assigned, in_progress, pending_review, completed, overdue, cancelled
            $table->date('due_date')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->boolean('timesheet_linked')->default(false);
            $table->decimal('estimated_hours', 6, 2)->nullable();
            $table->decimal('actual_hours', 6, 2)->default(0);
            $table->string('linked_module', 64)->nullable(); // travel, imprest, pif, procurement, etc.
            $table->unsignedBigInteger('linked_id')->nullable();
            $table->text('completion_notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::table('work_assignments', fn (Blueprint $t) => $t->index(['tenant_id', 'assigned_to', 'status']));
        Schema::table('work_assignments', fn (Blueprint $t) => $t->index(['tenant_id', 'assigned_by']));
        Schema::table('work_assignments', fn (Blueprint $t) => $t->index(['tenant_id', 'due_date']));
    }
    public function down(): void { Schema::dropIfExists('work_assignments'); }
};
