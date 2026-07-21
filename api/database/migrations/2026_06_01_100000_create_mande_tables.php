<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Monitoring & Evaluation / Results Monitoring module (PRD §10).
 *
 * Strategic Plan configuration is fully normalised (goals → objectives →
 * outcomes → outputs) so goals are configurable, not hard-coded, and archiving
 * a plan never breaks historical links (records are retained, never deleted).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Thematic Areas (admin-configurable lookup, §9.7/§27) ───────────────
        Schema::create('me_thematic_areas', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->string('code', 40);
            $table->string('name', 200);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'is_active']);
        });

        // ── Strategic Plans (§10.4) ────────────────────────────────────────────
        Schema::create('strategic_plans', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->string('name', 300);
            $table->string('period', 50)->nullable(); // e.g. "2024-2029"
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('status', 20)->default('draft'); // draft|active|archived
            $table->text('description')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'status']);
        });

        // ── Strategic Goals / Pillars (§10.4) ──────────────────────────────────
        Schema::create('strategic_goals', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('strategic_plan_id');
            $table->foreign('strategic_plan_id')->references('id')->on('strategic_plans')->cascadeOnDelete();

            $table->string('code', 40)->nullable();
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'strategic_plan_id']);
        });

        Schema::create('strategic_objectives', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('strategic_goal_id');
            $table->foreign('strategic_goal_id')->references('id')->on('strategic_goals')->cascadeOnDelete();

            $table->string('code', 40)->nullable();
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'strategic_goal_id']);
        });

        Schema::create('strategic_outcomes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('strategic_objective_id');
            $table->foreign('strategic_objective_id')->references('id')->on('strategic_objectives')->cascadeOnDelete();

            $table->string('code', 40)->nullable();
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'strategic_objective_id']);
        });

        Schema::create('strategic_outputs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('strategic_outcome_id');
            $table->foreign('strategic_outcome_id')->references('id')->on('strategic_outcomes')->cascadeOnDelete();

            $table->string('code', 40)->nullable();
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'strategic_outcome_id']);
        });

        // ── Results Frameworks (§10.5) ─────────────────────────────────────────
        Schema::create('results_frameworks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->string('name', 300);
            $table->string('type', 40)->default('institutional'); // sadc_pf|srhr|giz|donor|institutional
            $table->string('donor_name', 200)->nullable();
            $table->text('description')->nullable();

            $table->unsignedBigInteger('strategic_plan_id')->nullable();
            $table->foreign('strategic_plan_id')->references('id')->on('strategic_plans')->nullOnDelete();

            $table->unsignedBigInteger('strategic_goal_id')->nullable();
            $table->foreign('strategic_goal_id')->references('id')->on('strategic_goals')->nullOnDelete();

            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('status', 20)->default('active'); // active|inactive|archived

            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'type']);
            $table->index(['tenant_id', 'status']);
        });

        // ── Indicators (§10.6) ─────────────────────────────────────────────────
        Schema::create('indicators', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('results_framework_id')->nullable();
            $table->foreign('results_framework_id')->references('id')->on('results_frameworks')->nullOnDelete();

            $table->unsignedBigInteger('strategic_objective_id')->nullable();
            $table->foreign('strategic_objective_id')->references('id')->on('strategic_objectives')->nullOnDelete();

            $table->unsignedBigInteger('strategic_output_id')->nullable();
            $table->foreign('strategic_output_id')->references('id')->on('strategic_outputs')->nullOnDelete();

            $table->unsignedBigInteger('programme_id')->nullable();
            $table->foreign('programme_id')->references('id')->on('programmes')->nullOnDelete();

            $table->string('code', 60)->nullable();
            $table->string('name', 500);
            $table->string('result_level', 20)->default('output'); // impact|outcome|output|activity
            $table->string('unit', 80)->nullable();
            $table->decimal('baseline_value', 16, 2)->nullable();
            $table->string('baseline_year', 20)->nullable();
            $table->decimal('annual_target', 16, 2)->nullable();
            $table->decimal('cumulative_target', 16, 2)->nullable();
            $table->jsonb('disaggregation')->nullable(); // e.g. ["sex","age","country"]
            $table->string('data_source', 300)->nullable();
            $table->boolean('evidence_required')->default(true);
            $table->string('frequency', 20)->nullable(); // monthly|quarterly|bi_annual|annual
            $table->unsignedBigInteger('responsible_person_id')->nullable();
            $table->foreign('responsible_person_id')->references('id')->on('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'is_active']);
            $table->index(['tenant_id', 'result_level']);
        });

        // ── M&E Activity Reports (§10.7 + §10.8) ───────────────────────────────
        Schema::create('me_activity_reports', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            // Lightweight FK to the approved PIF (Programme). Additive only.
            $table->unsignedBigInteger('programme_id');
            $table->foreign('programme_id')->references('id')->on('programmes')->cascadeOnDelete();

            $table->string('reference_number', 40)->unique();
            $table->string('activity_title', 500);

            $table->unsignedBigInteger('responsible_officer_id')->nullable();
            $table->foreign('responsible_officer_id')->references('id')->on('users')->nullOnDelete();

            $table->unsignedBigInteger('thematic_area_id')->nullable();
            $table->foreign('thematic_area_id')->references('id')->on('me_thematic_areas')->nullOnDelete();

            $table->unsignedBigInteger('strategic_goal_id')->nullable();
            $table->foreign('strategic_goal_id')->references('id')->on('strategic_goals')->nullOnDelete();

            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();

            // Planned vs actual
            $table->text('planned_output')->nullable();
            $table->text('actual_output')->nullable();
            $table->integer('planned_participants')->nullable();
            $table->integer('actual_participants')->nullable();

            // §10.8 post-activity narrative fields
            $table->text('narrative')->nullable();
            $table->text('challenges')->nullable();
            $table->text('lessons_learned')->nullable();
            $table->text('recommendations')->nullable();
            $table->text('follow_up_actions')->nullable();

            // Review + closure (§10.10)
            $table->string('review_status', 30)->default('not_submitted');
            // not_submitted|submitted|returned|reviewed|accepted|closed
            $table->string('closure_status', 20)->default('open'); // open|closed
            $table->text('review_notes')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();

            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->foreign('submitted_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();

            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            $table->unsignedBigInteger('accepted_by')->nullable();
            $table->foreign('accepted_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();

            $table->unsignedBigInteger('closed_by')->nullable();
            $table->foreign('closed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'review_status']);
            $table->index(['tenant_id', 'programme_id']);
        });

        // Indicator linkage pivot — captures planned vs actual per activity
        Schema::create('me_activity_report_indicator', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('me_activity_report_id');
            $table->foreign('me_activity_report_id', 'mari_report_fk')
                ->references('id')->on('me_activity_reports')->cascadeOnDelete();

            $table->unsignedBigInteger('indicator_id');
            $table->foreign('indicator_id')->references('id')->on('indicators')->cascadeOnDelete();

            $table->decimal('planned_value', 16, 2)->nullable();
            $table->decimal('actual_value', 16, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['me_activity_report_id', 'indicator_id'], 'mari_unique');
        });

        // ── Evidence Repository (§10.9) ────────────────────────────────────────
        // Evidence metadata. The actual file is stored as a polymorphic Attachment
        // attached to this record (reuses the existing attachments table).
        Schema::create('me_evidence', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('me_activity_report_id')->nullable();
            $table->foreign('me_activity_report_id', 'me_evidence_report_fk')
                ->references('id')->on('me_activity_reports')->cascadeOnDelete();

            $table->unsignedBigInteger('programme_id')->nullable();
            $table->foreign('programme_id')->references('id')->on('programmes')->nullOnDelete();

            $table->unsignedBigInteger('indicator_id')->nullable();
            $table->foreign('indicator_id')->references('id')->on('indicators')->nullOnDelete();

            $table->string('title', 300)->nullable();
            $table->string('evidence_type', 40)->default('other');
            // attendance|photo|report|publication|media|financial|other
            $table->string('review_status', 20)->default('pending'); // pending|validated|rejected
            $table->integer('version')->default(1);
            $table->text('review_notes')->nullable();

            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();

            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'review_status']);
            $table->index(['tenant_id', 'me_activity_report_id'], 'me_evidence_report_idx');
        });

        // ── M&E Review History (immutable audit trail, §10.10) ─────────────────
        Schema::create('me_review_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('tenant_id');
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();

            $table->unsignedBigInteger('me_activity_report_id');
            $table->foreign('me_activity_report_id', 'mrh_report_fk')
                ->references('id')->on('me_activity_reports')->cascadeOnDelete();

            $table->unsignedBigInteger('actor_id');
            $table->foreign('actor_id')->references('id')->on('users')->cascadeOnDelete();

            $table->string('change_type', 50);
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30)->nullable();
            $table->jsonb('old_values')->nullable();
            $table->jsonb('new_values')->nullable();
            $table->string('hash', 64)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
            // immutable — no updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('me_review_history');
        Schema::dropIfExists('me_evidence');
        Schema::dropIfExists('me_activity_report_indicator');
        Schema::dropIfExists('me_activity_reports');
        Schema::dropIfExists('indicators');
        Schema::dropIfExists('results_frameworks');
        Schema::dropIfExists('strategic_outputs');
        Schema::dropIfExists('strategic_outcomes');
        Schema::dropIfExists('strategic_objectives');
        Schema::dropIfExists('strategic_goals');
        Schema::dropIfExists('strategic_plans');
        Schema::dropIfExists('me_thematic_areas');
    }
};
