<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lifecycle_journey_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('name');
            $table->string('lifecycle_type', 32); // onboarding | separation
            $table->string('status', 32)->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('lifecycle_journey_template_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('template_id')->constrained('lifecycle_journey_templates')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('status', 32)->default('draft'); // draft | published | archived
            $table->json('definition');
            $table->timestamp('published_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['template_id', 'version_number']);
        });

        Schema::create('lifecycle_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 32);
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('person_id')->nullable();
            $table->unsignedBigInteger('hr_file_id')->nullable();
            $table->string('lifecycle_type', 32);
            $table->foreignId('template_version_id')->constrained('lifecycle_journey_template_versions');
            $table->string('status', 32)->default('in_progress');
            $table->string('separation_reason', 64)->nullable();
            $table->date('start_date')->nullable();
            $table->date('target_start_date')->nullable();
            $table->date('last_working_day')->nullable();
            $table->date('notice_end_date')->nullable();
            $table->json('notice_snapshot')->nullable();
            $table->json('readiness')->nullable();
            $table->string('clearance_status', 32)->nullable();
            $table->boolean('terminal_payment_blocked')->default(false);
            $table->timestamp('terminal_payment_approved_at')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'lifecycle_type', 'status']);
        });

        Schema::create('lifecycle_stage_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('case_id')->constrained('lifecycle_cases')->cascadeOnDelete();
            $table->string('stage_key', 64);
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('parallel_group', 64)->nullable();
            $table->string('status', 32)->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['case_id', 'stage_key']);
        });

        Schema::create('lifecycle_task_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('case_id')->constrained('lifecycle_cases')->cascadeOnDelete();
            $table->foreignId('stage_instance_id')->constrained('lifecycle_stage_instances')->cascadeOnDelete();
            $table->string('task_key', 64);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('assignee_role', 64)->nullable();
            $table->string('department_slug', 64)->nullable();
            $table->boolean('mandatory')->default(true);
            $table->string('optional_group', 64)->nullable();
            $table->json('condition')->nullable();
            $table->date('due_date')->nullable();
            $table->integer('due_offset_days')->nullable();
            $table->string('due_anchor', 32)->nullable();
            $table->string('status', 32)->default('pending');
            $table->string('clearance_status', 32)->nullable();
            $table->boolean('evidence_required')->default(false);
            $table->unsignedBigInteger('assignment_id')->nullable();
            $table->unsignedBigInteger('workflow_request_id')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['case_id', 'task_key']);
            $table->index(['case_id', 'status']);
        });

        Schema::create('lifecycle_exceptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('case_id')->constrained('lifecycle_cases')->cascadeOnDelete();
            $table->foreignId('task_instance_id')->nullable()->constrained('lifecycle_task_instances')->nullOnDelete();
            $table->string('exception_type', 64);
            $table->text('reason');
            $table->string('status', 32)->default('pending');
            $table->foreignId('authoriser_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('authorised_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('lifecycle_evidence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('case_id')->constrained('lifecycle_cases')->cascadeOnDelete();
            $table->foreignId('task_instance_id')->constrained('lifecycle_task_instances')->cascadeOnDelete();
            $table->unsignedBigInteger('document_id')->nullable();
            $table->string('filename')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('lifecycle_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('case_id')->constrained('lifecycle_cases')->cascadeOnDelete();
            $table->string('event_type', 64);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('payload')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['case_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lifecycle_events');
        Schema::dropIfExists('lifecycle_evidence');
        Schema::dropIfExists('lifecycle_exceptions');
        Schema::dropIfExists('lifecycle_task_instances');
        Schema::dropIfExists('lifecycle_stage_instances');
        Schema::dropIfExists('lifecycle_cases');
        Schema::dropIfExists('lifecycle_journey_template_versions');
        Schema::dropIfExists('lifecycle_journey_templates');
    }
};
