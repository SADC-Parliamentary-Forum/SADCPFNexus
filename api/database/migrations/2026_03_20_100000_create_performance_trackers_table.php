<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('performance_trackers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('cycle_start');
            $table->date('cycle_end');
            $table->string('status', 32)->default('satisfactory'); // excellent, strong, satisfactory, watchlist, at_risk, critical_review_required
            $table->string('trend', 32)->default('insufficient_data'); // improving, stable, declining, inconsistent, insufficient_data
            $table->unsignedTinyInteger('output_score')->nullable();
            $table->unsignedTinyInteger('timeliness_score')->nullable();
            $table->unsignedTinyInteger('quality_score')->nullable();
            $table->unsignedTinyInteger('workload_score')->nullable();
            $table->unsignedTinyInteger('update_compliance_score')->nullable();
            $table->unsignedTinyInteger('development_progress_score')->nullable();
            $table->boolean('recognition_indicator')->default(false);
            $table->boolean('conduct_risk_indicator')->default(false);
            $table->unsignedInteger('overdue_task_count')->default(0);
            $table->unsignedInteger('blocked_task_count')->default(0);
            $table->unsignedInteger('completed_task_count')->default(0);
            $table->decimal('assignment_completion_rate', 5, 2)->nullable();
            $table->decimal('average_closure_delay_days', 5, 2)->nullable();
            $table->decimal('timesheet_hours_logged', 8, 2)->default(0);
            $table->unsignedInteger('commendation_count')->default(0);
            $table->unsignedInteger('disciplinary_case_count')->default(0);
            $table->boolean('active_warning_flag')->default(false);
            $table->unsignedInteger('active_development_action_count')->default(0);
            $table->boolean('probation_flag')->default(false);
            $table->boolean('hr_attention_required')->default(false);
            $table->boolean('management_attention_required')->default(false);
            $table->text('supervisor_summary')->nullable();
            $table->text('hr_summary')->nullable();
            $table->timestamp('last_recalculated_at')->nullable();
            $table->timestamps();
        });
        Schema::table('performance_trackers', fn (Blueprint $t) => $t->index(['tenant_id', 'employee_id']));
        Schema::table('performance_trackers', fn (Blueprint $t) => $t->index(['tenant_id', 'status']));
        Schema::table('performance_trackers', fn (Blueprint $t) => $t->index(['tenant_id', 'cycle_start', 'cycle_end']));
    }
    public function down(): void { Schema::dropIfExists('performance_trackers'); }
};
