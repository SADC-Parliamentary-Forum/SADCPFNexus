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
            'sla_snapshot' => collect($stages)->mapWithKeys(fn ($s) => [$s['step_order'] => $s['sla_hours'] ?? null])->all(),
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

    public function validate(WorkflowDefinitionVersion $version): array
    {
        $errors = [];
        $stages = $version->stages_snapshot ?? [];
        if ($stages === []) {
            $errors[] = 'Workflow must have at least one stage.';
        }
        $orders = [];
        foreach ($stages as $stage) {
            $order = $stage['step_order'] ?? null;
            if ($order === null) {
                $errors[] = 'Every stage needs step_order.';
            } elseif (in_array($order, $orders, true)) {
                $errors[] = "Duplicate step_order {$order}.";
            } else {
                $orders[] = $order;
            }
            if (empty($stage['actor_selector']) && empty($stage['approver_type'])) {
                $errors[] = "Stage {$order} is missing an actor selector.";
            }
            if (empty($stage['stage_type'])) {
                $errors[] = "Stage {$order} is missing stage_type.";
            }
            if (! empty($stage['requires_signature']) && empty($stage['authority_action'])) {
                // soft warning — still allow
            }
        }
        if (! collect($stages)->contains(fn ($s) => in_array($s['stage_type'] ?? '', ['approve', 'authorise', 'sign', 'release'], true))) {
            $errors[] = 'Workflow must include a terminal approve/authorise/sign/release stage.';
        }

        return $errors;
    }

    public function approve(WorkflowDefinitionVersion $version, User $actor): WorkflowDefinitionVersion
    {
        $errors = $this->validate($version);
        if ($errors !== []) {
            throw ValidationException::withMessages(['definition' => $errors]);
        }
        $version->update([
            'status' => 'approved',
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);
        $this->audit($version->definition, $actor, 'DefinitionVersionApproved', [
            'version_id' => $version->id,
        ]);

        return $version->fresh();
    }

    public function publish(WorkflowDefinitionVersion $version, User $actor): WorkflowDefinitionVersion
    {
        if (! in_array($version->status, ['approved', 'draft'], true)) {
            throw ValidationException::withMessages(['definition' => 'Only approved (or draft for bootstrap) versions can be published.']);
        }
        $errors = $this->validate($version);
        if ($errors !== []) {
            throw ValidationException::withMessages(['definition' => $errors]);
        }

        return DB::transaction(function () use ($version, $actor) {
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

            $workflow->update([
                'current_version' => $version->version_number,
                'definition_status' => 'published',
                'is_active' => true,
                'policy_reference' => $version->policy_reference,
            ]);

            $this->audit($workflow, $actor, 'DefinitionVersionPublished', [
                'version_id' => $version->id,
                'version_number' => $version->version_number,
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
