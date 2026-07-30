<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_samples', function (Blueprint $table) {
            $table->json('frozen_population')->nullable()->after('sample_ids');
            $table->boolean('is_frozen')->default(false)->after('frozen_population');
            $table->timestamp('frozen_at')->nullable()->after('is_frozen');
            $table->string('population_hash', 64)->nullable()->after('frozen_at');
            $table->string('source_module', 64)->nullable()->after('source_table');
            $table->text('adjustment_justification')->nullable()->after('population_hash');
            $table->json('adjusted_from_sample_ids')->nullable()->after('adjustment_justification');
            $table->unsignedBigInteger('adjusted_by')->nullable()->after('adjusted_from_sample_ids');
            $table->timestamp('adjusted_at')->nullable()->after('adjusted_by');
        });

        Schema::table('audit_external_engagements', function (Blueprint $table) {
            $table->boolean('evidence_room_enabled')->default(false)->after('access_active');
            $table->boolean('watermark_required')->default(true)->after('evidence_room_enabled');
            $table->timestamp('auto_revoke_at')->nullable()->after('access_ends_at');
            $table->timestamp('auto_revoked_at')->nullable()->after('auto_revoke_at');
        });

        Schema::create('audit_external_evidence_downloads', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('external_engagement_id')->index();
            $table->unsignedBigInteger('downloaded_by')->nullable();
            $table->string('document_label');
            $table->string('document_path')->nullable();
            $table->boolean('watermark_applied')->default(false);
            $table->string('ip_address', 64)->nullable();
            $table->timestamps();
        });

        Schema::create('audit_control_testing_campaigns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('title');
            $table->unsignedBigInteger('risk_campaign_id')->nullable()->index();
            $table->unsignedBigInteger('engagement_id')->nullable()->index();
            $table->unsignedBigInteger('universe_entity_id')->nullable()->index();
            $table->date('scheduled_start')->nullable();
            $table->date('scheduled_end')->nullable();
            $table->string('status', 32)->default('planned'); // planned|active|completed|cancelled
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_control_testing_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('campaign_id')->index();
            $table->unsignedBigInteger('finding_id')->nullable()->index();
            $table->string('control_ref')->nullable();
            $table->string('control_title');
            $table->string('status', 32)->default('pending'); // pending|passed|failed|overdue|waived
            $table->date('due_date')->nullable();
            $table->text('result_notes')->nullable();
            $table->unsignedBigInteger('tested_by')->nullable();
            $table->timestamp('tested_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_effort_budgets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('audit_plan_id')->nullable()->index();
            $table->unsignedBigInteger('engagement_id')->nullable()->index();
            $table->unsignedBigInteger('auditor_user_id')->nullable()->index();
            $table->decimal('budget_hours', 8, 2)->default(0);
            $table->string('label')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_effort_entries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('effort_budget_id')->nullable()->index();
            $table->unsignedBigInteger('engagement_id')->nullable()->index();
            $table->unsignedBigInteger('auditor_user_id')->index();
            $table->date('work_date');
            $table->decimal('hours', 8, 2);
            $table->string('activity', 128)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_qa_reviews', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->nullable()->index();
            $table->unsignedBigInteger('workpaper_id')->nullable()->index();
            $table->unsignedBigInteger('reviewer_id');
            $table->string('review_type', 64)->default('engagement_qa'); // engagement_qa|workpaper_qa|peer
            $table->string('outcome', 32)->default('pending'); // pending|satisfactory|needs_improvement|unsatisfactory
            $table->text('findings_summary')->nullable();
            $table->text('recommendations')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_donor_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->nullable()->index();
            $table->string('code', 64);
            $table->string('name');
            $table->string('donor_name')->nullable();
            $table->string('applies_to', 64)->default('engagement'); // engagement|report|both
            $table->json('sections')->nullable();
            $table->text('guidance')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('audit_engagement_template_applications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->unsignedBigInteger('donor_template_id')->index();
            $table->unsignedBigInteger('report_id')->nullable()->index();
            $table->json('applied_snapshot')->nullable();
            $table->unsignedBigInteger('applied_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_governance_packs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('title');
            $table->unsignedSmallInteger('fiscal_year')->nullable();
            $table->string('audience', 64)->default('fsc');
            $table->string('format', 32)->default('structured_json'); // structured_json|pdf_manifest|zip_manifest
            $table->json('payload');
            $table->unsignedBigInteger('generated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_external_appointments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('firm_name');
            $table->string('plenary_resolution_ref')->nullable();
            $table->date('appointed_on')->nullable();
            $table->date('term_starts_on')->nullable();
            $table->date('term_ends_on')->nullable();
            $table->boolean('independence_docs_on_file')->default(false);
            $table->string('independence_doc_path')->nullable();
            $table->unsignedBigInteger('procurement_tender_id')->nullable()->index();
            $table->string('status', 32)->default('active'); // active|expired|renewed|terminated
            $table->text('notes')->nullable();
            $table->json('renewals')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_ai_suggestions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->nullable()->index();
            $table->string('kind', 64); // workpaper_summary|duplicate_findings|root_cause|draft_report|evidence_index|nl_search
            $table->string('provider', 64)->default('stub');
            $table->string('status', 32)->default('pending_confirmation'); // pending_confirmation|applied|rejected|expired
            $table->boolean('auto_applied')->default(false);
            $table->json('input_context')->nullable();
            $table->json('suggestion')->nullable();
            $table->string('applied_action', 64)->nullable();
            $table->text('application_note')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('confirmed_by')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_ai_suggestions');
        Schema::dropIfExists('audit_external_appointments');
        Schema::dropIfExists('audit_governance_packs');
        Schema::dropIfExists('audit_engagement_template_applications');
        Schema::dropIfExists('audit_donor_templates');
        Schema::dropIfExists('audit_qa_reviews');
        Schema::dropIfExists('audit_effort_entries');
        Schema::dropIfExists('audit_effort_budgets');
        Schema::dropIfExists('audit_control_testing_items');
        Schema::dropIfExists('audit_control_testing_campaigns');
        Schema::dropIfExists('audit_external_evidence_downloads');

        Schema::table('audit_external_engagements', function (Blueprint $table) {
            $table->dropColumn(['evidence_room_enabled', 'watermark_required', 'auto_revoke_at', 'auto_revoked_at']);
        });

        Schema::table('audit_samples', function (Blueprint $table) {
            $table->dropColumn([
                'frozen_population', 'is_frozen', 'frozen_at', 'population_hash', 'source_module',
                'adjustment_justification', 'adjusted_from_sample_ids', 'adjusted_by', 'adjusted_at',
            ]);
        });
    }
};
