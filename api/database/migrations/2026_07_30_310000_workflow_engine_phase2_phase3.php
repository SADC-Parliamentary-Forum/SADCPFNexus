<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Workflow Engine Phase 2 + Phase 3 — extends the live engine (PRD §122–§123).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('approval_workflow_steps', function (Blueprint $table) {
            if (! Schema::hasColumn('approval_workflow_steps', 'completion_rule')) {
                $table->string('completion_rule', 32)->default('any')->after('decision_meanings');
                // any|all|quorum|percentage|lead_plus_support
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'quorum_count')) {
                $table->unsignedSmallInteger('quorum_count')->nullable()->after('completion_rule');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'quorum_percentage')) {
                $table->unsignedTinyInteger('quorum_percentage')->nullable()->after('quorum_count');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'parallel_group')) {
                $table->string('parallel_group', 64)->nullable()->after('quorum_percentage');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'parallel_role_key')) {
                $table->string('parallel_role_key', 64)->nullable()->after('parallel_group');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'sod_segregated')) {
                $table->boolean('sod_segregated')->default(false)->after('parallel_role_key');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'governance_body_name')) {
                $table->string('governance_body_name')->nullable()->after('sod_segregated');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'routing_strategy')) {
                $table->string('routing_strategy', 32)->default('primary')->after('governance_body_name');
                // primary|queue_claim|workload|deterministic_fallback
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'sla_calendar_code')) {
                $table->string('sla_calendar_code', 64)->nullable()->after('routing_strategy');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'sla_priority_variant')) {
                $table->string('sla_priority_variant', 32)->nullable()->after('sla_calendar_code');
                // standard|high|critical
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'pause_sla_on_hold')) {
                $table->boolean('pause_sla_on_hold')->default(true)->after('sla_priority_variant');
            }
            if (! Schema::hasColumn('approval_workflow_steps', 'high_risk')) {
                $table->boolean('high_risk')->default(false)->after('pause_sla_on_hold');
            }
        });

        Schema::table('approval_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('approval_requests', 'sla_paused_at')) {
                $table->timestamp('sla_paused_at')->nullable()->after('held_at');
            }
            if (! Schema::hasColumn('approval_requests', 'sla_paused_seconds')) {
                $table->unsignedInteger('sla_paused_seconds')->default(0)->after('sla_paused_at');
            }
            if (! Schema::hasColumn('approval_requests', 'active_parallel_steps')) {
                $table->json('active_parallel_steps')->nullable()->after('sla_paused_seconds');
            }
        });

        Schema::table('workflow_decisions', function (Blueprint $table) {
            if (! Schema::hasColumn('workflow_decisions', 'vote_value')) {
                $table->string('vote_value', 32)->nullable()->after('decision_type');
            }
            if (! Schema::hasColumn('workflow_decisions', 'is_quorum_vote')) {
                $table->boolean('is_quorum_vote')->default(false)->after('vote_value');
            }
            if (! Schema::hasColumn('workflow_decisions', 'governance_decision_id')) {
                $table->unsignedBigInteger('governance_decision_id')->nullable()->index()->after('is_quorum_vote');
            }
            if (! Schema::hasColumn('workflow_decisions', 'external_approval_id')) {
                $table->unsignedBigInteger('external_approval_id')->nullable()->index()->after('governance_decision_id');
            }
        });

        Schema::table('workflow_tasks', function (Blueprint $table) {
            if (! Schema::hasColumn('workflow_tasks', 'parallel_role_key')) {
                $table->string('parallel_role_key', 64)->nullable()->after('stage_type');
            }
            if (! Schema::hasColumn('workflow_tasks', 'routing_strategy')) {
                $table->string('routing_strategy', 32)->nullable()->after('assignment_reason');
            }
        });

        if (! Schema::hasTable('workflow_working_calendars')) {
            Schema::create('workflow_working_calendars', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->string('code', 64);
                $table->string('name');
                $table->json('working_days')->nullable(); // [1,2,3,4,5] ISO weekday
                $table->time('day_start')->default('08:00:00');
                $table->time('day_end')->default('17:00:00');
                $table->json('holidays')->nullable(); // ['2026-12-25', ...]
                $table->string('timezone', 64)->default('Africa/Windhoek');
                $table->boolean('is_default')->default(false);
                $table->timestamps();
                $table->unique(['tenant_id', 'code'], 'wf_calendar_tenant_code_unique');
            });
        }

        if (! Schema::hasTable('workflow_votes')) {
            Schema::create('workflow_votes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->unsignedInteger('step_index');
                $table->unsignedBigInteger('workflow_decision_id')->nullable()->index();
                $table->unsignedBigInteger('voter_user_id');
                $table->string('vote', 32); // approve|reject|abstain
                $table->text('comment')->nullable();
                $table->timestamp('voted_at');
                $table->timestamps();
                $table->unique(['approval_request_id', 'step_index', 'voter_user_id'], 'wf_vote_unique');
            });
        }

        if (! Schema::hasTable('workflow_governance_decisions')) {
            Schema::create('workflow_governance_decisions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->unsignedInteger('step_index')->nullable();
                $table->string('body_name'); // Decision authority
                $table->string('meeting_reference')->nullable();
                $table->string('resolution_reference')->nullable();
                $table->unsignedSmallInteger('members_present')->nullable();
                $table->unsignedSmallInteger('quorum_required')->nullable();
                $table->boolean('quorum_met')->default(false);
                $table->string('decision', 64); // approved|rejected|deferred|noted
                $table->json('voting_result')->nullable();
                $table->unsignedBigInteger('recorded_by'); // recorder ≠ body
                $table->string('recorder_role', 64)->nullable(); // secretary|chair|certifier
                $table->unsignedBigInteger('chair_user_id')->nullable();
                $table->string('minutes_evidence_path')->nullable();
                $table->date('decision_date')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_external_approvals')) {
            Schema::create('workflow_external_approvals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('approval_request_id')->index();
                $table->unsignedInteger('step_index')->nullable();
                $table->string('external_body')->nullable();
                $table->string('external_person')->nullable();
                $table->date('decision_date');
                $table->string('decision', 64); // approved|rejected|noted
                $table->string('evidence_reference')->nullable();
                $table->string('evidence_path')->nullable();
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('recorded_by');
                $table->timestamp('recorded_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_simulations')) {
            Schema::create('workflow_simulations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->unsignedBigInteger('workflow_definition_id')->index();
                $table->unsignedBigInteger('definition_version_id')->nullable()->index();
                $table->json('test_context')->nullable();
                $table->json('result')->nullable();
                $table->boolean('created_production_approval')->default(false);
                $table->unsignedBigInteger('simulated_by');
                $table->timestamp('simulated_at');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('workflow_ai_suggestions')) {
            Schema::create('workflow_ai_suggestions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id')->index();
                $table->string('kind', 64);
                $table->string('provider', 32)->default('stub');
                $table->string('status', 32)->default('pending_confirmation');
                $table->boolean('auto_applied')->default(false);
                $table->json('input_context')->nullable();
                $table->json('suggestion')->nullable();
                $table->string('applied_action', 64)->nullable();
                $table->text('apply_note')->nullable();
                $table->unsignedBigInteger('definition_version_id')->nullable()->index();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('applied_by')->nullable();
                $table->timestamp('applied_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_ai_suggestions');
        Schema::dropIfExists('workflow_simulations');
        Schema::dropIfExists('workflow_external_approvals');
        Schema::dropIfExists('workflow_governance_decisions');
        Schema::dropIfExists('workflow_votes');
        Schema::dropIfExists('workflow_working_calendars');
    }
};
