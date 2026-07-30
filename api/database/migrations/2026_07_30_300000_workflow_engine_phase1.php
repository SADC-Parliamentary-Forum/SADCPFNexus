<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Workflow Engine Phase 1 — evolves the live ApprovalWorkflow / ApprovalRequest
 * path (used by Leave, Travel, Salary Advance, Procurement, PIF) instead of
 * introducing a parallel temporary engine.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_workflows', function (Blueprint $table) {
            if (! Schema::hasColumn('approval_workflows', 'record_type')) {
                $table->string('record_type', 64)->nullable()->after('module_type');
            }
            if (! Schema::hasColumn('approval_workflows', 'definition_status')) {
                $table->string('definition_status', 32)->default('published')->after('is_active');
                // draft|pending_approval|published|retired
            }
            if (! Schema::hasColumn('approval_workflows', 'business_owner_id')) {
                $table->unsignedBigInteger('business_owner_id')->nullable()->after('definition_status');
            }
            if (! Schema::hasColumn('approval_workflows', 'current_version')) {
                $table->unsignedInteger('current_version')->default(1)->after('business_owner_id');
            }
            if (! Schema::hasColumn('approval_workflows', 'policy_reference')) {
                $table->string('policy_reference')->nullable()->after('current_version');
            }
        });

        if (! Schema::hasTable('workflow_definition_versions')) {
            Schema::create('workflow_definition_versions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('workflow_definition_id')->index(); // approval_workflows.id
                $table->unsignedInteger('version_number');
                $table->string('status', 32)->default('draft'); // draft|approved|published|retired
                $table->timestamp('effective_from')->nullable();
                $table->timestamp('effective_to')->nullable();
                $table->string('policy_reference')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->unsignedBigInteger('published_by')->nullable();
                $table->timestamp('published_at')->nullable();
                $table->string('configuration_hash', 64)->nullable();
                $table->json('stages_snapshot')->nullable();
                $table->json('transitions_snapshot')->nullable();
                $table->json('conditions_snapshot')->nullable();
                $table->json('actor_selectors_snapshot')->nullable();
                $table->json('sla_snapshot')->nullable();
                $table->json('escalation_snapshot')->nullable();
                $table->timestamps();
                $table->unique(['workflow_definition_id', 'version_number'], 'wf_def_version_unique');
            });
        }

        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            if (! Schema::hasColumn('approval_workflow_steps', 'stage_type')) {
                $table->string('stage_type', 32)->default('approve')->after('step_name');
                // prepare|submit|review|recommend|verify|certify|authorise|approve|sign|release|acknowledge|info
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'actor_selector')) {
                $table->string('actor_selector', 64)->nullable()->after('approver_type');
                // supervisor|hod|director_finance|sg|position|queue|authority_holder|specific_role|specific_user|up_the_chain
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'actor_selector_config')) {
                $table->json('actor_selector_config')->nullable()->after('actor_selector');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'authority_action')) {
                $table->string('authority_action', 128)->nullable()->after('actor_selector_config');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'amount_threshold')) {
                $table->decimal('amount_threshold', 15, 2)->nullable()->after('authority_action');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'currency')) {
                $table->string('currency', 8)->nullable()->after('amount_threshold');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'condition_expression')) {
                $table->json('condition_expression')->nullable()->after('currency');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'skip_if_condition_false')) {
                $table->boolean('skip_if_condition_false')->default(false)->after('condition_expression');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'requires_signature')) {
                $table->boolean('requires_signature')->default(false)->after('skip_if_condition_false');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'escalation_hours')) {
                $table->unsignedSmallInteger('escalation_hours')->nullable()->after('requires_signature');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'escalation_to_selector')) {
                $table->string('escalation_to_selector', 64)->nullable()->after('escalation_hours');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'reminder_hours')) {
                $table->unsignedSmallInteger('reminder_hours')->nullable()->after('escalation_to_selector');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'decision_meanings')) {
                $table->json('decision_meanings')->nullable()->after('reminder_hours');
            }
        });

        Schema::table('approval_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('approval_requests', 'uuid')) {
                $table->uuid('uuid')->nullable()->unique()->after('id');
            }
            if (! Schema::hasColumn('approval_requests', 'reference')) {
                $table->string('reference', 64)->nullable()->index()->after('uuid');
            }
            if (! Schema::hasColumn('approval_requests', 'definition_version_id')) {
                $table->unsignedBigInteger('definition_version_id')->nullable()->index()->after('workflow_id');
            }
            if (! Schema::hasColumn('approval_requests', 'record_version')) {
                $table->unsignedInteger('record_version')->default(1)->after('definition_version_id');
            }
            if (! Schema::hasColumn('approval_requests', 'approval_package_hash')) {
                $table->string('approval_package_hash', 64)->nullable()->after('record_version');
            }
            if (! Schema::hasColumn('approval_requests', 'locked_at')) {
                $table->timestamp('locked_at')->nullable()->after('approval_package_hash');
            }
            if (! Schema::hasColumn('approval_requests', 'submitted_by')) {
                $table->unsignedBigInteger('submitted_by')->nullable()->after('locked_at');
            }
            if (! Schema::hasColumn('approval_requests', 'applicant_id')) {
                $table->unsignedBigInteger('applicant_id')->nullable()->after('submitted_by');
            }
            if (! Schema::hasColumn('approval_requests', 'current_holder_ids')) {
                $table->json('current_holder_ids')->nullable()->after('applicant_id');
            }
            if (! Schema::hasColumn('approval_requests', 'current_stage_type')) {
                $table->string('current_stage_type', 32)->nullable()->after('current_holder_ids');
            }
            if (! Schema::hasColumn('approval_requests', 'due_at')) {
                $table->timestamp('due_at')->nullable()->index()->after('current_stage_type');
            }
            if (! Schema::hasColumn('approval_requests', 'escalated_at')) {
                $table->timestamp('escalated_at')->nullable()->after('due_at');
            }
            if (! Schema::hasColumn('approval_requests', 'held_at')) {
                $table->timestamp('held_at')->nullable()->after('escalated_at');
            }
            if (! Schema::hasColumn('approval_requests', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('held_at');
            }
            if (! Schema::hasColumn('approval_requests', 'condition_context')) {
                $table->json('condition_context')->nullable()->after('completed_at');
            }
            if (! Schema::hasColumn('approval_requests', 'idempotency_key')) {
                $table->string('idempotency_key', 128)->nullable()->after('condition_context');
            }
        });

        if (! Schema::hasTable('workflow_approval_packages')) {
            Schema::create('workflow_approval_packages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->unsignedInteger('package_version')->default(1);
                $table->string('package_hash', 64);
                $table->json('field_snapshot');
                $table->json('document_snapshot')->nullable();
                $table->json('locked_fields')->nullable();
                $table->json('diff_from_previous')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamp('locked_at')->nullable();
                $table->timestamps();
                $table->unique(['approval_request_id', 'package_version'], 'wf_pkg_version_unique');
            });
        }

        if (! Schema::hasTable('workflow_tasks')) {
            Schema::create('workflow_tasks', function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->nullable()->unique();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->unsignedInteger('step_index');
                $table->string('stage_type', 32);
                $table->string('decision_type', 32)->nullable(); // recommend|certify|authorise|approve|sign|...
                $table->unsignedBigInteger('assigned_user_id')->nullable()->index();
                $table->string('assigned_queue', 64)->nullable();
                $table->string('status', 32)->default('awaiting'); // awaiting|claimed|completed|reassigned|escalated|cancelled
                $table->string('assignment_reason')->nullable();
                $table->json('actor_resolution_snapshot')->nullable();
                $table->unsignedBigInteger('delegation_id')->nullable();
                $table->unsignedBigInteger('acting_appointment_id')->nullable();
                $table->unsignedBigInteger('authority_snapshot_id')->nullable();
                $table->timestamp('assigned_at')->nullable();
                $table->timestamp('acknowledged_at')->nullable();
                $table->timestamp('claimed_at')->nullable();
                $table->unsignedBigInteger('claimed_by')->nullable();
                $table->timestamp('due_at')->nullable()->index();
                $table->timestamp('reminded_at')->nullable();
                $table->timestamp('escalated_at')->nullable();
                $table->unsignedTinyInteger('escalation_level')->default(0);
                $table->timestamp('completed_at')->nullable();
                $table->string('idempotency_key', 128)->nullable();
                $table->timestamps();
                $table->index(['assigned_user_id', 'status'], 'wf_tasks_assignee_status');
            });
        }

        if (! Schema::hasTable('workflow_decisions')) {
            Schema::create('workflow_decisions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->unsignedBigInteger('workflow_task_id')->nullable()->index();
                $table->unsignedInteger('step_index');
                $table->string('stage_type', 32);
                $table->string('decision_type', 32); // approve|reject|return|recommend|certify|authorise|sign|withdraw|cancel|...
                $table->unsignedBigInteger('actor_user_id');
                $table->json('position_snapshot')->nullable();
                $table->json('department_snapshot')->nullable();
                $table->json('authority_snapshot')->nullable();
                $table->json('delegation_snapshot')->nullable();
                $table->json('acting_appointment_snapshot')->nullable();
                $table->unsignedInteger('record_version')->nullable();
                $table->string('approval_package_hash', 64)->nullable();
                $table->text('comments')->nullable();
                $table->unsignedBigInteger('document_signature_event_id')->nullable();
                $table->string('authentication_strength', 32)->nullable();
                $table->string('idempotency_key', 128)->nullable()->unique();
                $table->timestamp('decided_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_release_events')) {
            Schema::create('workflow_release_events', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->string('event_type', 64); // WorkflowCompleted|downstream.module.release
                $table->string('target', 128)->nullable();
                $table->string('status', 32)->default('pending'); // pending|succeeded|failed|retrying
                $table->unsignedTinyInteger('attempts')->default(0);
                $table->timestamp('next_retry_at')->nullable();
                $table->text('last_error')->nullable();
                $table->json('payload')->nullable();
                $table->string('idempotency_key', 128)->nullable()->unique();
                $table->timestamp('succeeded_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_escalations')) {
            Schema::create('workflow_escalations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->unsignedBigInteger('workflow_task_id')->nullable();
                $table->string('type', 32)->default('escalate'); // escalate|reroute|remind
                $table->unsignedBigInteger('from_user_id')->nullable();
                $table->unsignedBigInteger('to_user_id')->nullable();
                $table->string('reason')->nullable();
                $table->unsignedTinyInteger('level')->default(1);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_certificates')) {
            Schema::create('workflow_certificates', function (Blueprint $table) {
                $table->id();
                $table->uuid('uuid')->unique();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->unique();
                $table->string('certificate_hash', 64);
                $table->json('certificate_body');
                $table->timestamp('issued_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_audit_events')) {
            Schema::create('workflow_audit_events', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->nullable()->index();
                $table->unsignedBigInteger('workflow_definition_id')->nullable()->index();
                $table->string('event_type', 64);
                $table->unsignedBigInteger('actor_user_id')->nullable();
                $table->json('payload')->nullable();
                $table->timestamp('occurred_at');
                $table->timestamps();
                $table->index(['tenant_id', 'event_type', 'occurred_at'], 'wf_audit_tenant_type_time');
            });
        }

        if (! Schema::hasTable('workflow_idempotency_keys')) {
            Schema::create('workflow_idempotency_keys', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->string('scope', 64); // start|decide|complete|release
                $table->string('idempotency_key', 128);
                $table->string('result_type', 64)->nullable();
                $table->unsignedBigInteger('result_id')->nullable();
                $table->json('response_snapshot')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'scope', 'idempotency_key'], 'wf_idem_unique');
            });
        }

        Schema::table('approval_histories', function (Blueprint $table) {
            if (! Schema::hasColumn('approval_histories', 'step_index')) {
                $table->unsignedInteger('step_index')->nullable()->after('user_id');
            }
            if (! Schema::hasColumn('approval_histories', 'stage_type')) {
                $table->string('stage_type', 32)->nullable()->after('step_index');
            }
            if (! Schema::hasColumn('approval_histories', 'decision_type')) {
                $table->string('decision_type', 32)->nullable()->after('action');
            }
            if (! Schema::hasColumn('approval_histories', 'authority_snapshot_id')) {
                $table->unsignedBigInteger('authority_snapshot_id')->nullable()->after('comment');
            }
            if (! Schema::hasColumn('approval_histories', 'package_hash')) {
                $table->string('package_hash', 64)->nullable()->after('authority_snapshot_id');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_idempotency_keys');
        Schema::dropIfExists('workflow_audit_events');
        Schema::dropIfExists('workflow_certificates');
        Schema::dropIfExists('workflow_escalations');
        Schema::dropIfExists('workflow_release_events');
        Schema::dropIfExists('workflow_decisions');
        Schema::dropIfExists('workflow_tasks');
        Schema::dropIfExists('workflow_approval_packages');
        Schema::dropIfExists('workflow_definition_versions');
    }
};
