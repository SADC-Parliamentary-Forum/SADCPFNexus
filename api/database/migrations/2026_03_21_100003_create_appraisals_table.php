<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('appraisals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cycle_id')->constrained('appraisal_cycles')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('hod_id')->nullable()->constrained('users')->nullOnDelete();
            // Status lifecycle
            $table->string('status', 32)->default('draft'); // draft, employee_submitted, supervisor_reviewed, hod_reviewed, hr_reviewed, finalized
            // Self assessment
            $table->text('self_assessment')->nullable();
            $table->unsignedTinyInteger('self_overall_rating')->nullable(); // 1-5
            // Supervisor review
            $table->text('supervisor_comments')->nullable();
            $table->unsignedTinyInteger('supervisor_rating')->nullable();
            $table->timestamp('supervisor_reviewed_at')->nullable();
            // HOD review
            $table->text('hod_comments')->nullable();
            $table->unsignedTinyInteger('hod_rating')->nullable();
            $table->timestamp('hod_reviewed_at')->nullable();
            // HR/Final
            $table->text('hr_comments')->nullable();
            $table->unsignedTinyInteger('overall_rating')->nullable(); // final 1-5
            $table->string('overall_rating_label', 64)->nullable(); // Exceeds Expectations, Meets, Below, etc.
            $table->boolean('probation_recommendation')->nullable(); // confirm, extend, terminate
            $table->string('probation_outcome', 32)->nullable(); // confirmed, extended, terminated, n/a
            $table->boolean('promotion_recommendation')->default(false);
            $table->text('development_plan')->nullable();
            $table->text('sg_decision')->nullable();
            // Acknowledgement
            $table->boolean('employee_acknowledged')->default(false);
            $table->timestamp('employee_acknowledged_at')->nullable();
            // Timestamps
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();
        });
        Schema::table('appraisals', fn (Blueprint $t) => $t->index(['tenant_id', 'employee_id']));
        Schema::table('appraisals', fn (Blueprint $t) => $t->index(['tenant_id', 'cycle_id', 'status']));
        Schema::table('appraisals', fn (Blueprint $t) => $t->index(['tenant_id', 'supervisor_id']));
    }
    public function down(): void { Schema::dropIfExists('appraisals'); }
};
