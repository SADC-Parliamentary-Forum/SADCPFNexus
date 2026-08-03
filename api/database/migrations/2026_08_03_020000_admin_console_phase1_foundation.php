<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_modules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('module_key', 80);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('version', 40)->nullable();
            $table->foreignId('business_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('technical_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 40)->default('active');
            $table->string('availability', 40)->default('operational');
            $table->json('routes')->nullable();
            $table->json('required_permissions')->nullable();
            $table->json('background_jobs')->nullable();
            $table->json('integration_events')->nullable();
            $table->foreignId('data_retention_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('health_status', 40)->default('operational');
            $table->string('release_version', 80)->nullable();
            $table->json('feature_flags')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'module_key']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('module_dependencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_module_id')->constrained('platform_modules')->cascadeOnDelete();
            $table->foreignId('depends_on_module_id')->nullable()->constrained('platform_modules')->nullOnDelete();
            $table->string('depends_on_key', 80);
            $table->string('dependency_type', 40)->default('shared_service');
            $table->string('criticality', 40)->default('medium');
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'source_module_id', 'depends_on_key'], 'module_dep_unique');
        });

        Schema::create('configuration_definitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('config_key', 120);
            $table->string('domain', 80);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('data_type', 40);
            $table->json('allowed_values')->nullable();
            $table->json('default_value')->nullable();
            $table->string('environment_scope', 40)->default('tenant');
            $table->string('organisational_scope', 80)->nullable();
            $table->string('sensitivity', 40)->default('operational');
            $table->string('change_authority', 120)->nullable();
            $table->json('validation_rule')->nullable();
            $table->boolean('restart_required')->default(false);
            $table->boolean('rollback_supported')->default(true);
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'config_key']);
            $table->index(['tenant_id', 'domain', 'status']);
        });

        Schema::create('configuration_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('configuration_definition_id')->constrained('configuration_definitions')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('value')->nullable();
            $table->string('value_hash', 64);
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->timestamp('effective_from')->nullable();
            $table->timestamp('effective_to')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('activation_status', 40)->default('active');
            $table->foreignId('rollback_version_id')->nullable()->constrained('configuration_versions')->nullOnDelete();
            $table->string('change_reference', 80)->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamps();

            $table->unique(['configuration_definition_id', 'version']);
            $table->index(['tenant_id', 'activation_status']);
        });

        Schema::create('configuration_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->foreignId('configuration_definition_id')->constrained('configuration_definitions')->cascadeOnDelete();
            $table->foreignId('current_version_id')->nullable()->constrained('configuration_versions')->nullOnDelete();
            $table->json('current_value')->nullable();
            $table->json('proposed_value')->nullable();
            $table->text('reason');
            $table->text('business_justification')->nullable();
            $table->string('risk_assessment', 40)->default('operational');
            $table->json('affected_modules')->nullable();
            $table->json('affected_users')->nullable();
            $table->timestamp('effective_from')->nullable();
            $table->text('testing_evidence')->nullable();
            $table->text('rollback_plan')->nullable();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('technical_reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('business_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('security_reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 40)->default('proposed');
            $table->json('validation_result')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('rolled_back_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('configuration_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('configuration_change_request_id')->constrained('configuration_change_requests')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->string('review_type', 40);
            $table->string('decision', 40);
            $table->text('notes')->nullable();
            $table->timestamp('reviewed_at');
            $table->timestamps();

            $table->index(['tenant_id', 'review_type', 'decision']);
        });

        Schema::create('reference_data_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('set_key', 100);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('domain', 80);
            $table->foreignId('business_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('technical_custodian_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('hierarchical')->default(false);
            $table->boolean('multilingual')->default(true);
            $table->boolean('effective_dated')->default(true);
            $table->boolean('extensible')->default(true);
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'set_key']);
            $table->index(['tenant_id', 'domain', 'status']);
        });

        Schema::create('reference_data_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reference_data_set_id')->constrained('reference_data_sets')->cascadeOnDelete();
            $table->uuid('uuid')->unique();
            $table->string('code', 100);
            $table->string('label_en');
            $table->string('label_fr')->nullable();
            $table->string('label_pt')->nullable();
            $table->text('description')->nullable();
            $table->foreignId('parent_item_id')->nullable()->constrained('reference_data_items')->nullOnDelete();
            $table->unsignedInteger('sequence')->default(0);
            $table->timestamp('effective_from')->nullable();
            $table->timestamp('effective_to')->nullable();
            $table->timestamp('deprecated_at')->nullable();
            $table->foreignId('replacement_item_id')->nullable()->constrained('reference_data_items')->nullOnDelete();
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['reference_data_set_id', 'code']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('reference_data_item_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reference_data_item_id')->constrained('reference_data_items')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('changed_at');
            $table->timestamps();

            $table->unique(['reference_data_item_id', 'version']);
        });

        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('flag_key', 120);
            $table->text('description')->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('flag_type', 40)->default('release');
            $table->boolean('default_enabled')->default(false);
            $table->string('environment', 40)->default('production');
            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();
            $table->string('status', 40)->default('draft');
            $table->json('configuration')->nullable();
            $table->text('rollback_plan')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('retired_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'flag_key', 'environment']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('feature_flag_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feature_flag_id')->constrained('feature_flags')->cascadeOnDelete();
            $table->string('target_type', 40);
            $table->string('target_value', 120);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['feature_flag_id', 'target_type', 'target_value'], 'feature_flag_target_unique');
        });

        Schema::create('institutional_calendars', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('calendar_key', 100);
            $table->string('name');
            $table->string('duty_station', 120)->nullable();
            $table->string('timezone', 80)->default('Africa/Windhoek');
            $table->json('working_days')->nullable();
            $table->json('working_hours')->nullable();
            $table->unsignedSmallInteger('effective_year')->nullable();
            $table->string('source_authority')->nullable();
            $table->string('status', 40)->default('active');
            $table->timestamps();

            $table->unique(['tenant_id', 'calendar_key']);
        });

        Schema::create('calendar_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institutional_calendar_id')->constrained('institutional_calendars')->cascadeOnDelete();
            $table->date('date');
            $table->string('day_type', 40);
            $table->string('title');
            $table->text('description')->nullable();
            $table->boolean('affects_sla')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['institutional_calendar_id', 'date', 'day_type'], 'calendar_day_unique');
        });

        Schema::create('numbering_schemes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('scheme_key', 100);
            $table->string('name');
            $table->string('prefix', 40);
            $table->string('year_component', 40)->default('yyyy');
            $table->string('department_component', 40)->nullable();
            $table->unsignedSmallInteger('sequence_length')->default(5);
            $table->string('reset_rule', 40)->default('yearly');
            $table->string('separator', 8)->default('-');
            $table->string('example')->nullable();
            $table->timestamp('effective_from')->nullable();
            $table->timestamp('effective_to')->nullable();
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'scheme_key']);
        });

        Schema::create('numbering_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('numbering_scheme_id')->constrained('numbering_schemes')->cascadeOnDelete();
            $table->string('period_key', 40);
            $table->unsignedBigInteger('current_value')->default(0);
            $table->json('voided_references')->nullable();
            $table->timestamps();

            $table->unique(['numbering_scheme_id', 'period_key']);
        });

        Schema::create('localisation_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('translation_key', 180);
            $table->string('module', 80);
            $table->text('text_en');
            $table->text('context')->nullable();
            $table->string('status', 40)->default('active');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->unique(['tenant_id', 'translation_key']);
            $table->index(['tenant_id', 'module', 'status']);
        });

        Schema::create('localisation_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('localisation_key_id')->constrained('localisation_keys')->cascadeOnDelete();
            $table->string('language', 8);
            $table->text('translated_text')->nullable();
            $table->string('status', 40)->default('missing');
            $table->foreignId('translator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['localisation_key_id', 'language']);
        });

        Schema::create('integration_definitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('integration_key', 120);
            $table->string('name');
            $table->string('system_name')->nullable();
            $table->text('purpose')->nullable();
            $table->foreignId('business_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('technical_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('direction', 40)->default('internal');
            $table->json('data_classes')->nullable();
            $table->string('authentication_type', 80)->nullable();
            $table->string('environment', 40)->default('production');
            $table->string('endpoint_reference')->nullable();
            $table->string('status', 40)->default('unknown');
            $table->timestamp('last_success_at')->nullable();
            $table->timestamp('last_failure_at')->nullable();
            $table->json('retry_policy')->nullable();
            $table->string('service_account')->nullable();
            $table->string('secret_reference')->nullable();
            $table->timestamp('credential_expires_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'integration_key']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('integration_health_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('integration_definition_id')->constrained('integration_definitions')->cascadeOnDelete();
            $table->string('status', 40);
            $table->string('outcome', 40)->default('success');
            $table->text('message')->nullable();
            $table->json('metrics')->nullable();
            $table->timestamp('detected_at');
            $table->timestamps();
        });

        Schema::create('scheduled_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('job_key', 120);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('owner')->nullable();
            $table->string('schedule')->nullable();
            $table->string('timezone', 80)->default('Africa/Windhoek');
            $table->boolean('enabled')->default(true);
            $table->string('concurrency_policy', 40)->default('single_instance');
            $table->json('retry_policy')->nullable();
            $table->unsignedInteger('timeout_seconds')->default(300);
            $table->json('dependencies')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->timestamp('next_run_at')->nullable();
            $table->string('last_result', 40)->nullable();
            $table->string('criticality', 40)->default('operational');
            $table->string('status', 40)->default('active');
            $table->timestamps();

            $table->unique(['tenant_id', 'job_key']);
            $table->index(['tenant_id', 'enabled', 'status']);
        });

        Schema::create('scheduled_job_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('scheduled_job_id')->constrained('scheduled_jobs')->cascadeOnDelete();
            $table->uuid('run_uuid')->unique();
            $table->string('trigger_type', 40)->default('manual');
            $table->foreignId('triggered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('status', 40)->default('queued');
            $table->unsignedInteger('records_processed')->default(0);
            $table->unsignedInteger('records_failed')->default(0);
            $table->unsignedInteger('retry_count')->default(0);
            $table->uuid('correlation_id')->nullable();
            $table->text('error_summary')->nullable();
            $table->string('output_reference')->nullable();
            $table->text('reason')->nullable();
            $table->json('scope')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('queue_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('queue_key', 120);
            $table->unsignedInteger('queue_depth')->default(0);
            $table->timestamp('oldest_message_at')->nullable();
            $table->decimal('processing_rate', 10, 2)->nullable();
            $table->decimal('failure_rate', 6, 2)->nullable();
            $table->string('worker_status', 40)->default('unknown');
            $table->unsignedInteger('retry_count')->default(0);
            $table->timestamp('captured_at');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'queue_key', 'captured_at']);
        });

        Schema::create('dead_letter_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('source_service', 80);
            $table->string('message_id', 160)->nullable();
            $table->text('failure_reason');
            $table->unsignedInteger('attempts')->default(0);
            $table->string('affected_record_type')->nullable();
            $table->string('affected_record_id')->nullable();
            $table->string('severity', 40)->default('medium');
            $table->boolean('replay_safe')->default(false);
            $table->foreignId('resolution_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 40)->default('open');
            $table->json('original_payload')->nullable();
            $table->json('resolution')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'severity']);
        });

        Schema::create('maintenance_windows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->string('title');
            $table->text('purpose');
            $table->json('affected_services')->nullable();
            $table->timestamp('planned_start');
            $table->timestamp('planned_end');
            $table->text('expected_impact')->nullable();
            $table->json('read_only_services')->nullable();
            $table->json('unavailable_services')->nullable();
            $table->foreignId('business_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('technical_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('communication_plan')->nullable();
            $table->text('rollback_plan')->nullable();
            $table->string('maintenance_mode', 40)->default('notice_only');
            $table->string('status', 40)->default('proposed');
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('actual_start')->nullable();
            $table->timestamp('actual_end')->nullable();
            $table->text('outcome')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('system_banners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('banner_type', 40);
            $table->string('priority', 40)->default('normal');
            $table->json('audience')->nullable();
            $table->string('language', 8)->default('en');
            $table->text('message');
            $table->timestamp('start_at');
            $table->timestamp('end_at')->nullable();
            $table->boolean('dismissible')->default(true);
            $table->boolean('acknowledgement_required')->default(false);
            $table->string('secure_link')->nullable();
            $table->string('status', 40)->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'start_at']);
        });

        Schema::create('operational_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->string('category', 80);
            $table->string('severity', 40)->default('medium');
            $table->string('source_service', 80)->nullable();
            $table->text('message');
            $table->json('affected_records')->nullable();
            $table->string('status', 40)->default('new');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('detected_at');
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status', 'severity']);
        });

        Schema::create('data_quality_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('rule_key', 120);
            $table->string('module', 80);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('severity', 40)->default('medium');
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->json('definition')->nullable();
            $table->string('status', 40)->default('active');
            $table->timestamps();

            $table->unique(['tenant_id', 'rule_key']);
        });

        Schema::create('data_quality_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->foreignId('data_quality_rule_id')->nullable()->constrained('data_quality_rules')->nullOnDelete();
            $table->string('module', 80);
            $table->string('record_type')->nullable();
            $table->string('record_id')->nullable();
            $table->string('severity', 40)->default('medium');
            $table->text('description');
            $table->text('suggested_resolution')->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 40)->default('open');
            $table->json('verification')->nullable();
            $table->timestamp('detected_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status', 'severity']);
        });

        Schema::create('data_correction_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->string('module', 80);
            $table->string('subject_type');
            $table->string('subject_id');
            $table->json('current_value_snapshot')->nullable();
            $table->json('proposed_change')->nullable();
            $table->text('reason');
            $table->unsignedBigInteger('evidence_document_id')->nullable();
            $table->foreignId('business_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('technical_reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('execution_method', 120)->nullable();
            $table->json('dry_run_result')->nullable();
            $table->foreignId('executed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('executed_at')->nullable();
            $table->json('verification_result')->nullable();
            $table->string('rollback_reference')->nullable();
            $table->string('status', 40)->default('requested');
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status', 'module']);
        });

        Schema::create('import_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->string('import_type', 80);
            $table->string('source_filename')->nullable();
            $table->string('status', 40)->default('uploaded');
            $table->json('mapping')->nullable();
            $table->json('dry_run_result')->nullable();
            $table->unsignedInteger('rows_total')->default(0);
            $table->unsignedInteger('rows_valid')->default(0);
            $table->unsignedInteger('rows_failed')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('executed_at')->nullable();
            $table->json('reconciliation_result')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
        });

        Schema::create('migration_register', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->string('source_system');
            $table->string('source_owner')->nullable();
            $table->json('data_classes')->nullable();
            $table->text('scope')->nullable();
            $table->string('mapping_version', 80)->nullable();
            $table->string('environment', 40)->default('production');
            $table->json('dry_run_result')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('record_counts')->nullable();
            $table->json('failed_records')->nullable();
            $table->json('reconciliation')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('rollback_reference')->nullable();
            $table->string('status', 40)->default('planned');
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
        });

        Schema::create('backup_status_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('backup_type', 80);
            $table->string('status', 40)->default('unknown');
            $table->timestamp('last_success_at')->nullable();
            $table->timestamp('last_verification_at')->nullable();
            $table->timestamp('last_restore_test_at')->nullable();
            $table->string('recovery_point_status', 80)->nullable();
            $table->text('failure_summary')->nullable();
            $table->json('capacity')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'backup_type']);
        });

        Schema::create('restore_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->string('restore_type', 80);
            $table->text('reason');
            $table->json('scope')->nullable();
            $table->string('target_environment', 80);
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('data_loss_impact')->nullable();
            $table->text('security_review')->nullable();
            $table->foreignId('execution_owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('verification')->nullable();
            $table->text('outcome')->nullable();
            $table->string('status', 40)->default('requested');
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
        });

        Schema::create('support_access_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->foreignId('support_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('ticket_reference', 120);
            $table->text('reason');
            $table->json('scope')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at');
            $table->string('status', 40)->default('requested');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->json('post_session_review')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status', 'expires_at']);
        });

        Schema::create('break_glass_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80);
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('incident_reference', 120);
            $table->text('reason');
            $table->json('requested_permissions')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at');
            $table->string('status', 40)->default('pending_approval');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->json('post_use_review')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'reference']);
            $table->index(['tenant_id', 'status', 'expires_at']);
        });
    }

    public function down(): void
    {
        foreach ([
            'break_glass_sessions',
            'support_access_sessions',
            'restore_requests',
            'backup_status_records',
            'migration_register',
            'import_jobs',
            'data_correction_requests',
            'data_quality_issues',
            'data_quality_rules',
            'operational_alerts',
            'system_banners',
            'maintenance_windows',
            'dead_letter_records',
            'queue_snapshots',
            'scheduled_job_runs',
            'scheduled_jobs',
            'integration_health_events',
            'integration_definitions',
            'localisation_values',
            'localisation_keys',
            'numbering_sequences',
            'numbering_schemes',
            'calendar_days',
            'institutional_calendars',
            'feature_flag_targets',
            'feature_flags',
            'reference_data_item_versions',
            'reference_data_items',
            'reference_data_sets',
            'configuration_reviews',
            'configuration_change_requests',
            'configuration_versions',
            'configuration_definitions',
            'module_dependencies',
            'platform_modules',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
