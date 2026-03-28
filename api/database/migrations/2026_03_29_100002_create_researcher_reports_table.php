<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('researcher_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('deployment_id')->constrained('staff_deployments')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('parliament_id')->constrained('parliaments')->cascadeOnDelete();
            $table->string('reference_number', 32)->unique();
            $table->string('report_type', 32)->default('monthly'); // monthly|quarterly|annual|ad_hoc
            $table->date('period_start');
            $table->date('period_end');
            $table->string('title');
            $table->string('status', 32)->default('draft'); // draft|submitted|acknowledged|revision_requested|archived
            $table->text('executive_summary')->nullable();
            $table->json('activities_undertaken')->nullable(); // [{title, description, date, outcome}]
            $table->text('challenges_faced')->nullable();
            $table->text('recommendations')->nullable();
            $table->text('next_period_plan')->nullable();
            $table->json('srhr_indicators')->nullable(); // {indicator_key: value}
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('revision_notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::table('researcher_reports', function (Blueprint $table) {
            $table->index(['tenant_id']);
            $table->index(['tenant_id', 'employee_id']);
            $table->index(['tenant_id', 'deployment_id']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'report_type', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('researcher_reports');
    }
};
