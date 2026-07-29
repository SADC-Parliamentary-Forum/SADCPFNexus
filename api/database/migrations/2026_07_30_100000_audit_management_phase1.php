<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_lookups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->nullable()->index();
            $table->string('category', 64); // audit_type | rating | root_cause
            $table->string('code', 64);
            $table->string('label', 255);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'category', 'code']);
        });

        Schema::create('audit_universe_entities', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('name');
            $table->string('entity_type', 64)->default('process'); // process|system|department|project|location
            $table->unsignedBigInteger('department_id')->nullable()->index();
            $table->string('owner_name')->nullable();
            $table->unsignedBigInteger('owner_user_id')->nullable()->index();
            $table->text('description')->nullable();
            $table->string('risk_profile', 32)->nullable(); // low|medium|high|critical
            $table->unsignedSmallInteger('inherent_risk_score')->nullable();
            $table->date('last_audited_at')->nullable();
            $table->string('status', 32)->default('active'); // active|inactive|archived
            $table->string('confidentiality_level', 32)->default('standard');
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_plans', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('title');
            $table->unsignedSmallInteger('fiscal_year');
            $table->unsignedInteger('version')->default(1);
            $table->string('status', 32)->default('draft'); // draft|pending_approval|approved|amended|archived
            $table->text('summary')->nullable();
            $table->text('amendment_reason')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->string('confidentiality_level', 32)->default('standard');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_plan_versions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('audit_plan_id')->index();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->text('change_summary')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['audit_plan_id', 'version']);
        });

        Schema::create('audit_plan_approvals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('audit_plan_id')->index();
            $table->unsignedInteger('plan_version');
            $table->string('action', 32); // submit|approve|reject|amend
            $table->text('comments')->nullable();
            $table->unsignedBigInteger('actor_id');
            $table->timestamps();
        });

        Schema::create('audit_engagements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('audit_plan_id')->nullable()->index();
            $table->unsignedBigInteger('universe_entity_id')->nullable()->index();
            $table->string('reference_number')->nullable();
            $table->string('title');
            $table->string('audit_type', 64)->nullable();
            $table->string('status', 48)->default('planned');
            // planned|notified|independence_pending|fieldwork|reporting|issued|closed|cancelled
            $table->date('planned_start')->nullable();
            $table->date('planned_end')->nullable();
            $table->date('actual_start')->nullable();
            $table->date('actual_end')->nullable();
            $table->unsignedBigInteger('lead_auditor_id')->nullable()->index();
            $table->unsignedBigInteger('auditee_owner_id')->nullable()->index();
            $table->unsignedBigInteger('department_id')->nullable()->index();
            $table->text('objectives')->nullable();
            $table->text('scope')->nullable();
            $table->boolean('notification_sent')->default(false);
            $table->timestamp('notification_sent_at')->nullable();
            $table->string('confidentiality_level', 32)->default('restricted');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_independence_declarations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('status', 32)->default('pending'); // pending|cleared|recused|blocked
            $table->text('declaration_text')->nullable();
            $table->text('conflict_notes')->nullable();
            $table->timestamp('declared_at')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->unique(['engagement_id', 'user_id']);
        });

        Schema::create('audit_evidence_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('due_date')->nullable();
            $table->string('status', 32)->default('open'); // open|responded|closed|overdue
            $table->unsignedBigInteger('requested_from_user_id')->nullable()->index();
            $table->unsignedBigInteger('requested_by')->nullable();
            $table->string('confidentiality_level', 32)->default('restricted');
            $table->timestamps();
        });

        Schema::create('audit_evidence_responses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('evidence_request_id')->index();
            $table->unsignedBigInteger('responded_by');
            $table->text('response_text')->nullable();
            $table->string('attachment_path')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_workpapers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->string('reference')->nullable();
            $table->string('title');
            $table->text('content')->nullable();
            $table->string('status', 32)->default('draft'); // draft|under_review|final
            $table->unsignedBigInteger('prepared_by')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->boolean('is_immutable')->default(false);
            $table->string('confidentiality_level', 32)->default('restricted');
            $table->timestamps();
        });

        Schema::create('audit_workpaper_review_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('workpaper_id')->index();
            $table->unsignedBigInteger('author_id');
            $table->text('note');
            $table->timestamps();
        });

        Schema::create('audit_samples', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->string('method', 64); // random|judgmental|systematic|stratified|full_population
            $table->unsignedInteger('population_size')->nullable();
            $table->unsignedInteger('sample_size')->nullable();
            $table->text('population_description')->nullable();
            $table->text('rationale')->nullable();
            $table->string('source_table')->nullable();
            $table->json('sample_ids')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_observations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('open'); // open|converted|dismissed
            $table->unsignedBigInteger('converted_finding_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->string('confidentiality_level', 32)->default('restricted');
            $table->timestamps();
        });

        Schema::create('audit_findings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->unsignedBigInteger('observation_id')->nullable()->index();
            $table->string('reference_number')->nullable();
            $table->string('title');
            $table->text('criterion')->nullable();
            $table->text('condition_text')->nullable();
            $table->text('cause')->nullable();
            $table->text('effect')->nullable();
            $table->text('recommendation')->nullable();
            $table->string('rating', 64)->nullable();
            $table->string('root_cause_category', 64)->nullable();
            $table->string('status', 48)->default('draft');
            // draft|issued|management_response|corrective_in_progress|due_for_verification|closed|reopened|risk_accepted
            $table->boolean('is_final')->default(false);
            $table->unsignedBigInteger('issued_by')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->unsignedBigInteger('repeat_of_finding_id')->nullable()->index();
            $table->unsignedBigInteger('linked_risk_id')->nullable()->index();
            $table->string('risk_acceptance_status', 32)->nullable(); // linked|acceptance_pending|accepted|null
            $table->unsignedBigInteger('created_by')->nullable();
            $table->string('confidentiality_level', 32)->default('restricted');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_management_responses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('finding_id')->index();
            $table->unsignedInteger('version')->default(1);
            $table->text('response_text');
            $table->boolean('agrees')->default(true);
            $table->text('disagreement_notes')->nullable();
            $table->unsignedBigInteger('responded_by');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_recommendations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('finding_id')->index();
            $table->text('recommendation_text');
            $table->string('status', 32)->default('open'); // open|accepted|rejected|superseded
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_corrective_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('finding_id')->index();
            $table->unsignedBigInteger('recommendation_id')->nullable()->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('owner_user_id')->nullable()->index();
            $table->date('due_date')->nullable();
            $table->string('status', 48)->default('planned');
            // planned|in_progress|completed|due_for_verification|verified_closed|reopened|cancelled
            $table->unsignedBigInteger('assignment_id')->nullable()->index();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('implemented_by')->nullable(); // SoD: cannot verify if they implemented
            $table->timestamp('completed_at')->nullable();
            $table->string('confidentiality_level', 32)->default('restricted');
            $table->timestamps();
        });

        Schema::create('audit_verifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('corrective_action_id')->index();
            $table->unsignedBigInteger('finding_id')->index();
            $table->string('outcome', 32); // verified_closed|reopened|insufficient
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('verified_by');
            $table->timestamp('verified_at');
            $table->timestamps();
        });

        Schema::create('audit_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('engagement_id')->index();
            $table->string('title');
            $table->string('status', 32)->default('draft'); // draft|final
            $table->longText('body')->nullable();
            $table->boolean('is_immutable')->default(false);
            $table->unsignedBigInteger('issued_by')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->string('confidentiality_level', 32)->default('restricted');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_report_distributions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('report_id')->index();
            $table->unsignedBigInteger('recipient_user_id')->nullable();
            $table->string('recipient_email')->nullable();
            $table->string('recipient_name')->nullable();
            $table->unsignedBigInteger('distributed_by');
            $table->timestamp('distributed_at');
            $table->timestamps();
        });

        Schema::create('audit_external_engagements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('title');
            $table->string('auditor_firm')->nullable();
            $table->string('status', 32)->default('planned');
            $table->date('access_starts_at')->nullable();
            $table->date('access_ends_at')->nullable();
            $table->boolean('access_active')->default(false);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('coordinator_id')->nullable();
            $table->string('confidentiality_level', 32)->default('confidential');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_external_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('external_engagement_id')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('open');
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_external_findings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('external_engagement_id')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('open');
            $table->unsignedBigInteger('linked_finding_id')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_external_access_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('external_engagement_id')->index();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('action', 64);
            $table->json('meta')->nullable();
            $table->string('ip_address', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('audit_module_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->string('event', 128);
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->json('payload')->nullable();
            $table->string('entry_hash', 64)->nullable();
            $table->string('previous_hash', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['auditable_type', 'auditable_id']);
        });

        Schema::create('audit_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->unique();
            $table->string('plan_approval_mode', 32)->default('sg'); // sg|governance|configurable
            $table->boolean('charter_configured')->default(false);
            $table->text('charter_notes')->nullable();
            $table->json('notification_templates')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        $tables = [
            'audit_settings',
            'audit_module_events',
            'audit_external_access_logs',
            'audit_external_findings',
            'audit_external_requests',
            'audit_external_engagements',
            'audit_report_distributions',
            'audit_reports',
            'audit_verifications',
            'audit_corrective_actions',
            'audit_recommendations',
            'audit_management_responses',
            'audit_findings',
            'audit_observations',
            'audit_samples',
            'audit_workpaper_review_notes',
            'audit_workpapers',
            'audit_evidence_responses',
            'audit_evidence_requests',
            'audit_independence_declarations',
            'audit_engagements',
            'audit_plan_approvals',
            'audit_plan_versions',
            'audit_plans',
            'audit_universe_entities',
            'audit_lookups',
        ];
        foreach ($tables as $t) {
            Schema::dropIfExists($t);
        }
    }
};
