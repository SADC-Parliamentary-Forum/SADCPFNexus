<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalRequest;
use App\Models\ApprovalStep;
use App\Models\ApprovalWorkflow;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowAuditEvent;
use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Versioned workflow definitions: draft → approve → publish → retire (PRD §13–§17).
 * Historical instances keep their definition_version_id.
 */
class DefinitionVersionService
{
    public function __construct(
        private readonly ?DefinitionLintService $linter = null,
    ) {}

    private function linter(): DefinitionLintService
    {
        return $this->linter ?? app(DefinitionLintService::class);
    }

    public function createVersion(ApprovalWorkflow $workflow, User $actor, ?array $overrides = null): WorkflowDefinitionVersion
    {
        $next = (int) WorkflowDefinitionVersion::where('workflow_definition_id', $workflow->id)->max('version_number') + 1;
        $stages = $workflow->steps()->orderBy('step_order')->get()->map(fn (ApprovalStep $s) => [
            'step_order' => $s->step_order,
            'step_name' => $s->step_name,
            'stage_type' => $s->stage_type ?? 'approve',
            'approver_type' => $s->approver_type,
            'actor_selector' => $s->actor_selector ?? $s->approver_type,
            'actor_selector_config' => $s->actor_selector_config,
            'authority_action' => $s->authority_action,
            'amount_threshold' => $s->amount_threshold,
            'currency' => $s->currency,
            'condition_expression' => $s->condition_expression,
            'skip_if_condition_false' => (bool) $s->skip_if_condition_false,
            'requires_signature' => (bool) $s->requires_signature,
            'allow_return' => (bool) $s->allow_return,
            'allow_reject' => (bool) $s->allow_reject,
            'allow_delegate' => (bool) $s->allow_delegate,
            'sla_hours' => $s->sla_hours,
            'escalation_hours' => $s->escalation_hours,
            'reminder_hours' => $s->reminder_hours,
            'role_id' => $s->role_id,
            'user_id' => $s->user_id,
            'decision_meanings' => $s->decision_meanings,
            'completion_rule' => $s->completion_rule ?? 'any',
            'quorum_count' => $s->quorum_count,
            'quorum_percentage' => $s->quorum_percentage,
            'parallel_group' => $s->parallel_group,
            'parallel_role_key' => $s->parallel_role_key,
            'sod_segregated' => (bool) $s->sod_segregated,
            'governance_body_name' => $s->governance_body_name,
            'routing_strategy' => $s->routing_strategy ?? 'primary',
            'sla_calendar_code' => $s->sla_calendar_code,
            'sla_priority_variant' => $s->sla_priority_variant,
            'pause_sla_on_hold' => (bool) ($s->pause_sla_on_hold ?? true),
            'high_risk' => (bool) $s->high_risk,
        ])->all();

        if ($overrides) {
            $stages = $overrides['stages'] ?? $stages;
        }

        $hash = hash('sha256', json_encode($stages));

        $version = WorkflowDefinitionVersion::create([
            'tenant_id' => $workflow->tenant_id,
            'workflow_definition_id' => $workflow->id,
            'version_number' => $next,
            'status' => 'draft',
            'policy_reference' => $overrides['policy_reference'] ?? $workflow->policy_reference,
            'configuration_hash' => $hash,
            'stages_snapshot' => $stages,
            'transitions_snapshot' => $overrides['transitions'] ?? $this->defaultTransitions($stages),
            'conditions_snapshot' => $overrides['conditions'] ?? [],
            'actor_selectors_snapshot' => collect($stages)->pluck('actor_selector', 'step_order')->all(),
            'sla_snapshot' => collect($stages)->mapWithKeys(fn ($s) => [$s['step_order'] => [
                'hours' => $s['sla_hours'] ?? null,
                'calendar' => $s['sla_calendar_code'] ?? null,
                'priority' => $s['sla_priority_variant'] ?? null,
            ]])->all(),
            'escalation_snapshot' => collect($stages)->mapWithKeys(fn ($s) => [$s['step_order'] => [
                'hours' => $s['escalation_hours'] ?? null,
            ]])->all(),
        ]);

        $this->audit($workflow, $actor, 'DefinitionVersionCreated', [
            'version_id' => $version->id,
            'version_number' => $next,
        ]);

        return $version;
    }

    /**
     * Update a draft version's stages/transitions (visual designer save).
     */
    public function updateDraft(WorkflowDefinitionVersion $version, array $payload, User $actor): WorkflowDefinitionVersion
    {
        if ($version->status !== 'draft') {
            throw ValidationException::withMessages(['definition' => 'Only draft versions can be edited in the designer.']);
        }
        $stages = $payload['stages'] ?? $version->stages_snapshot ?? [];
        $transitions = $payload['transitions'] ?? $version->transitions_snapshot ?? $this->defaultTransitions($stages);
        $version->update([
            'stages_snapshot' => $stages,
            'transitions_snapshot' => $transitions,
            'conditions_snapshot' => $payload['conditions'] ?? $version->conditions_snapshot,
            'configuration_hash' => hash('sha256', json_encode($stages)),
            'actor_selectors_snapshot' => collect($stages)->pluck('actor_selector', 'step_order')->all(),
            'policy_reference' => $payload['policy_reference'] ?? $version->policy_reference,
        ]);
        $this->audit($version->definition, $actor, 'DefinitionDraftUpdated', [
            'version_id' => $version->id,
        ]);

        return $version->fresh();
    }

    public function validate(WorkflowDefinitionVersion $version): array
    {
        $lint = $this->lint($version);

        return $lint['hard'];
    }

    public function lint(WorkflowDefinitionVersion $version): array
    {
        return $this->linter()->lint(
            $version->stages_snapshot ?? [],
            $version->transitions_snapshot ?? []
        );
    }

    public function approve(WorkflowDefinitionVersion $version, User $actor): WorkflowDefinitionVersion
    {
        $lint = $this->lint($version);
        if ($lint['hard'] !== []) {
            throw ValidationException::withMessages(['definition' => $lint['hard']]);
        }
        $version->update([
            'status' => 'approved',
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);
        $this->audit($version->definition, $actor, 'DefinitionVersionApproved', [
            'version_id' => $version->id,
            'lint_soft' => $lint['soft'],
        ]);

        return $version->fresh();
    }

    public function publish(WorkflowDefinitionVersion $version, User $actor): WorkflowDefinitionVersion
    {
        if (! in_array($version->status, ['approved', 'draft'], true)) {
            throw ValidationException::withMessages(['definition' => 'Only approved (or draft for bootstrap) versions can be published.']);
        }
        $lint = $this->lint($version);
        if ($lint['hard'] !== []) {
            throw ValidationException::withMessages([
                'definition' => $lint['hard'],
                'lint' => 'Publish blocked by definition lint hard failures.',
            ]);
        }

        return DB::transaction(function () use ($version, $actor, $lint) {
            $workflow = ApprovalWorkflow::lockForUpdate()->findOrFail($version->workflow_definition_id);

            WorkflowDefinitionVersion::where('workflow_definition_id', $workflow->id)
                ->where('status', 'published')
                ->where('id', '!=', $version->id)
                ->update([
                    'status' => 'retired',
                    'effective_to' => now(),
                ]);

            $version->update([
                'status' => 'published',
                'published_by' => $actor->id,
                'published_at' => now(),
                'effective_from' => now(),
                'effective_to' => null,
            ]);

            // Sync live steps from published snapshot when designer stages provided
            $this->syncStepsFromSnapshot($workflow, $version->stages_snapshot ?? []);

            $workflow->update([
                'current_version' => $version->version_number,
                'definition_status' => 'published',
                'is_active' => true,
                'policy_reference' => $version->policy_reference,
            ]);

            $this->audit($workflow, $actor, 'DefinitionVersionPublished', [
                'version_id' => $version->id,
                'version_number' => $version->version_number,
                'lint_soft' => $lint['soft'],
            ]);

            return $version->fresh();
        });
    }

    public function retire(WorkflowDefinitionVersion $version, User $actor): WorkflowDefinitionVersion
    {
        $version->update([
            'status' => 'retired',
            'effective_to' => now(),
        ]);
        $this->audit($version->definition, $actor, 'DefinitionVersionRetired', [
            'version_id' => $version->id,
        ]);

        return $version->fresh();
    }

    public function publishedVersionFor(ApprovalWorkflow $workflow): ?WorkflowDefinitionVersion
    {
        return WorkflowDefinitionVersion::where('workflow_definition_id', $workflow->id)
            ->where('status', 'published')
            ->orderByDesc('version_number')
            ->first();
    }

    public function ensurePublishedSnapshot(ApprovalWorkflow $workflow, User $actor): WorkflowDefinitionVersion
    {
        $existing = $this->publishedVersionFor($workflow);
        if ($existing) {
            return $existing;
        }
        $draft = $this->createVersion($workflow, $actor);
        $draft->update(['status' => 'approved', 'approved_by' => $actor->id, 'approved_at' => now()]);

        return $this->publish($draft->fresh(), $actor);
    }

    private function defaultTransitions(array $stages): array
    {
        $ordered = collect($stages)->sortBy('step_order')->values();
        $transitions = [];
        foreach ($ordered as $i => $stage) {
            $next = $ordered->get($i + 1);
            $transitions[] = [
                'from' => $stage['step_order'],
                'on' => 'approve',
                'to' => $next['step_order'] ?? 'completed',
            ];
            $transitions[] = [
                'from' => $stage['step_order'],
                'on' => 'reject',
                'to' => 'rejected',
            ];
            $transitions[] = [
                'from' => $stage['step_order'],
                'on' => 'return',
                'to' => 'returned',
            ];
        }

        return $transitions;
    }

    private function syncStepsFromSnapshot(ApprovalWorkflow $workflow, array $stages): void
    {
        if ($stages === []) {
            return;
        }
        $workflow->steps()->delete();
        foreach ($stages as $i => $stage) {
            $workflow->steps()->create([
                'step_order' => $stage['step_order'] ?? $i,
                'step_name' => $stage['step_name'] ?? null,
                'stage_type' => $stage['stage_type'] ?? 'approve',
                'approver_type' => $stage['approver_type'] ?? $stage['actor_selector'] ?? 'supervisor',
                'actor_selector' => $stage['actor_selector'] ?? $stage['approver_type'] ?? 'supervisor',
                'actor_selector_config' => $stage['actor_selector_config'] ?? null,
                'authority_action' => $stage['authority_action'] ?? null,
                'amount_threshold' => $stage['amount_threshold'] ?? null,
                'currency' => $stage['currency'] ?? null,
                'condition_expression' => $stage['condition_expression'] ?? null,
                'skip_if_condition_false' => (bool) ($stage['skip_if_condition_false'] ?? false),
                'requires_signature' => (bool) ($stage['requires_signature'] ?? false),
                'allow_return' => (bool) ($stage['allow_return'] ?? true),
                'allow_reject' => (bool) ($stage['allow_reject'] ?? true),
                'allow_delegate' => (bool) ($stage['allow_delegate'] ?? true),
                'sla_hours' => $stage['sla_hours'] ?? null,
                'escalation_hours' => $stage['escalation_hours'] ?? null,
                'reminder_hours' => $stage['reminder_hours'] ?? null,
                'role_id' => $stage['role_id'] ?? null,
                'user_id' => $stage['user_id'] ?? null,
                'decision_meanings' => $stage['decision_meanings'] ?? null,
                'completion_rule' => $stage['completion_rule'] ?? 'any',
                'quorum_count' => $stage['quorum_count'] ?? null,
                'quorum_percentage' => $stage['quorum_percentage'] ?? null,
                'parallel_group' => $stage['parallel_group'] ?? null,
                'parallel_role_key' => $stage['parallel_role_key'] ?? null,
                'sod_segregated' => (bool) ($stage['sod_segregated'] ?? false),
                'governance_body_name' => $stage['governance_body_name'] ?? null,
                'routing_strategy' => $stage['routing_strategy'] ?? 'primary',
                'sla_calendar_code' => $stage['sla_calendar_code'] ?? null,
                'sla_priority_variant' => $stage['sla_priority_variant'] ?? null,
                'pause_sla_on_hold' => (bool) ($stage['pause_sla_on_hold'] ?? true),
                'high_risk' => (bool) ($stage['high_risk'] ?? false),
            ]);
        }
    }

    private function audit(?ApprovalWorkflow $workflow, User $actor, string $type, array $payload): void
    {
        if (! $workflow) {
            return;
        }
        WorkflowAuditEvent::create([
            'tenant_id' => $workflow->tenant_id,
            'workflow_definition_id' => $workflow->id,
            'event_type' => $type,
            'actor_user_id' => $actor->id,
            'payload' => $payload,
            'occurred_at' => now(),
        ]);
    }
}
