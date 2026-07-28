<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_reporting_periods', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('reference', 40);
            $table->date('start_date');
            $table->date('end_date');
            $table->timestamp('employee_due_at')->nullable();
            $table->timestamp('supervisor_due_at')->nullable();
            $table->timestamp('department_due_at')->nullable();
            $table->timestamp('management_due_at')->nullable();
            $table->string('status', 40)->default('open');
            $table->json('configuration_snapshot')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'start_date', 'end_date'], 'weekly_periods_tenant_range_unique');
            $table->unique(['tenant_id', 'reference'], 'weekly_periods_tenant_ref_unique');
        });

        Schema::create('weekly_reports', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('reference', 40);
            $table->foreignId('period_id')->constrained('weekly_reporting_periods')->cascadeOnDelete();
            $table->string('report_type', 30); // individual|department|institutional
            $table->foreignId('employee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->unsignedBigInteger('programme_id')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->foreignId('supervisor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('prepared_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 40)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->string('confidentiality', 40)->default('internal');
            $table->boolean('declaration_confirmed')->default(false);
            $table->timestamp('declaration_confirmed_at')->nullable();
            $table->boolean('no_activity')->default(false);
            $table->text('additional_notes')->nullable();
            $table->string('work_location_status', 60)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('employee_due_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'reference'], 'weekly_reports_tenant_ref_unique');
            $table->index(['tenant_id', 'period_id', 'report_type', 'status']);
            $table->index(['employee_id', 'period_id']);
            $table->index(['department_id', 'period_id']);
        });

        // Partial unique: one active individual report per employee/period
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("CREATE UNIQUE INDEX weekly_reports_individual_active_unique ON weekly_reports (tenant_id, period_id, employee_id) WHERE report_type = 'individual' AND deleted_at IS NULL AND employee_id IS NOT NULL");
            DB::statement("CREATE UNIQUE INDEX weekly_reports_department_active_unique ON weekly_reports (tenant_id, period_id, department_id) WHERE report_type = 'department' AND deleted_at IS NULL AND department_id IS NOT NULL");
            DB::statement("CREATE UNIQUE INDEX weekly_reports_institutional_active_unique ON weekly_reports (tenant_id, period_id) WHERE report_type = 'institutional' AND deleted_at IS NULL");
        } else {
            Schema::table('weekly_reports', function (Blueprint $table) {
                $table->unique(['tenant_id', 'period_id', 'employee_id', 'report_type'], 'weekly_reports_indiv_fallback_unique');
            });
        }

        Schema::create('weekly_report_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->string('section_type', 40); // achievement|wip|meeting|note|consolidated
            $table->string('title');
            $table->text('narrative')->nullable();
            $table->unsignedInteger('sequence')->default(0);
            $table->string('source_type', 64)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('source_reference_snapshot')->nullable();
            $table->string('source_status_snapshot', 60)->nullable();
            $table->text('result_or_expected_outcome')->nullable();
            $table->date('due_date')->nullable();
            $table->string('priority', 20)->nullable();
            $table->string('confidentiality', 40)->default('internal');
            $table->boolean('include_in_consolidation')->default(true);
            $table->string('status', 30)->default('active');
            $table->json('structured')->nullable();
            $table->timestamps();

            $table->index(['weekly_report_id', 'section_type']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('weekly_report_blockers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->foreignId('weekly_report_item_id')->nullable()->constrained('weekly_report_items')->nullOnDelete();
            $table->string('problem');
            $table->text('impact')->nullable();
            $table->string('responsible_party')->nullable();
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('action_taken')->nullable();
            $table->text('assistance_required')->nullable();
            $table->string('severity', 20)->default('medium');
            $table->string('status', 30)->default('open');
            $table->string('source_type', 64)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('confidentiality', 40)->default('internal');
            $table->boolean('include_in_consolidation')->default(true);
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamps();
        });

        Schema::create('weekly_report_decision_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->foreignId('weekly_report_item_id')->nullable()->constrained('weekly_report_items')->nullOnDelete();
            $table->string('decision_requested');
            $table->string('requested_from')->nullable();
            $table->foreignId('requested_from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('deadline')->nullable();
            $table->text('impact_if_delayed')->nullable();
            $table->string('status', 30)->default('open');
            $table->text('decision_recorded')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->unsignedBigInteger('follow_up_assignment_id')->nullable();
            $table->unsignedBigInteger('follow_up_risk_id')->nullable();
            $table->string('confidentiality', 40)->default('internal');
            $table->boolean('include_in_consolidation')->default(true);
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamps();
        });

        Schema::create('weekly_report_priorities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->foreignId('weekly_report_item_id')->nullable()->constrained('weekly_report_items')->nullOnDelete();
            $table->string('priority_text');
            $table->text('intended_result')->nullable();
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('linked_assignment_id')->nullable();
            $table->foreignId('carried_from_priority_id')->nullable()->constrained('weekly_report_priorities')->nullOnDelete();
            $table->unsignedInteger('carry_count')->default(0);
            $table->boolean('stale_warning')->default(false);
            $table->string('status', 30)->default('planned');
            $table->string('source_type', 64)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('confidentiality', 40)->default('internal');
            $table->boolean('include_in_consolidation')->default(true);
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamps();
        });

        Schema::create('weekly_report_support_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->string('department_or_person')->nullable();
            $table->text('support_needed');
            $table->date('required_date')->nullable();
            $table->string('status', 30)->default('open');
            $table->string('confidentiality', 40)->default('internal');
            $table->boolean('include_in_consolidation')->default(true);
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamps();
        });

        Schema::create('weekly_report_risks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->string('emerging_issue');
            $table->text('possible_impact')->nullable();
            $table->text('immediate_mitigation')->nullable();
            $table->boolean('escalate_to_risk_register')->default(false);
            $table->unsignedBigInteger('linked_risk_id')->nullable();
            $table->string('status', 30)->default('open');
            $table->string('confidentiality', 40)->default('internal');
            $table->boolean('include_in_consolidation')->default(true);
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamps();
        });

        Schema::create('weekly_report_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->string('action', 40); // accept|return|clarify|no_report_required|escalate|recommend_highlight
            $table->string('comment_type', 40)->nullable();
            $table->text('comments')->nullable();
            $table->string('section_or_item')->nullable();
            $table->text('correction_requested')->nullable();
            $table->date('resubmission_due_date')->nullable();
            $table->boolean('is_confidential')->default(false);
            $table->unsignedInteger('report_version')->nullable();
            $table->timestamps();
        });

        Schema::create('weekly_report_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('reason', 80)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('snapshot');
            $table->timestamps();

            $table->unique(['weekly_report_id', 'version']);
        });

        Schema::create('weekly_report_consolidation_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('destination_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->foreignId('destination_item_id')->nullable()->constrained('weekly_report_items')->nullOnDelete();
            $table->string('source_entity_type', 40); // item|blocker|decision|priority|risk|support
            $table->unsignedBigInteger('source_entity_id');
            $table->foreignId('source_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->foreignId('source_employee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('edited_narrative')->nullable();
            $table->foreignId('selected_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('selected_at');
            $table->timestamps();

            $table->index(['destination_report_id', 'source_entity_type', 'source_entity_id'], 'wrc_dest_source_idx');
        });

        Schema::create('weekly_report_exemptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->foreignId('period_id')->constrained('weekly_reporting_periods')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 80); // full_week_leave|other
            $table->unsignedBigInteger('leave_request_id')->nullable();
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['period_id', 'employee_id']);
        });

        Schema::create('weekly_report_deadline_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->timestamp('previous_due_at')->nullable();
            $table->timestamp('new_due_at');
            $table->text('reason')->nullable();
            $table->foreignId('changed_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('weekly_report_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->string('disk')->default('local');
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('weekly_report_suggestion_decisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->string('source_type', 64);
            $table->unsignedBigInteger('source_id');
            $table->string('decision', 20); // included|excluded
            $table->string('suggested_section', 40)->nullable();
            $table->foreignId('decided_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('decided_at');
            $table->timestamps();

            $table->unique(['weekly_report_id', 'source_type', 'source_id'], 'wrsd_report_source_unique');
        });

        Schema::create('weekly_report_audit_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->foreignId('weekly_report_id')->nullable()->constrained('weekly_reports')->nullOnDelete();
            $table->foreignId('period_id')->nullable()->constrained('weekly_reporting_periods')->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event_type', 80);
            $table->json('payload')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_report_audit_events');
        Schema::dropIfExists('weekly_report_suggestion_decisions');
        Schema::dropIfExists('weekly_report_documents');
        Schema::dropIfExists('weekly_report_deadline_changes');
        Schema::dropIfExists('weekly_report_exemptions');
        Schema::dropIfExists('weekly_report_consolidation_links');
        Schema::dropIfExists('weekly_report_versions');
        Schema::dropIfExists('weekly_report_reviews');
        Schema::dropIfExists('weekly_report_risks');
        Schema::dropIfExists('weekly_report_support_requests');
        Schema::dropIfExists('weekly_report_priorities');
        Schema::dropIfExists('weekly_report_decision_requests');
        Schema::dropIfExists('weekly_report_blockers');
        Schema::dropIfExists('weekly_report_items');
        Schema::dropIfExists('weekly_reports');
        Schema::dropIfExists('weekly_reporting_periods');
    }
};
