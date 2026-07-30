<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalStep;
use App\Models\ApprovalWorkflow;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use App\Models\WorkflowEngine\WorkflowSimulation;
use Illuminate\Support\Str;

/**
 * Admin workflow simulation — never creates production approvals (PRD §115 / §122).
 */
class WorkflowSimulationService
{
    public function __construct(
        private readonly ActorResolutionService $actors,
        private readonly ConditionEvaluationService $conditions,
        private readonly SlaCalendarService $sla,
        private readonly DefinitionVersionService $definitions,
    ) {}

    public function simulate(
        ApprovalWorkflow $workflow,
        User $actor,
        array $testContext = [],
        ?WorkflowDefinitionVersion $version = null
    ): WorkflowSimulation {
        $version = $version ?: $this->definitions->publishedVersionFor($workflow);
        $stages = $version?->stages_snapshot;
        if ($stages === null) {
            $stages = $workflow->steps()->orderBy('step_order')->get()->map(fn (ApprovalStep $s) => $s->toArray())->all();
        }

        $projected = [];
        $path = [];
        foreach (collect($stages)->sortBy('step_order')->values() as $i => $stage) {
            $step = new ApprovalStep($stage);
            $applies = true;
            if (! empty($stage['condition_expression']) && ! empty($stage['skip_if_condition_false'])) {
                $applies = $this->conditions->stageApplies($step, $testContext);
            }
            $actors = [];
            $reason = 'skipped';
            $due = null;
            if ($applies) {
                try {
                    $resolution = $this->actors->resolve($step, $actor, $testContext);
                    $actors = collect($resolution['actors'])->map(fn (User $u) => [
                        'id' => $u->id,
                        'name' => $u->name,
                        'email' => $u->email,
                    ])->all();
                    $reason = $resolution['reason'];
                } catch (\Throwable $e) {
                    $reason = 'Actor resolution failed: '.$e->getMessage();
                }
                if (! empty($stage['sla_hours'])) {
                    $cal = $this->sla->resolveCalendar((int) $workflow->tenant_id, $stage['sla_calendar_code'] ?? null);
                    $due = $this->sla->computeDueAt(
                        now(),
                        (int) $stage['sla_hours'],
                        $cal,
                        $stage['sla_priority_variant'] ?? null
                    )->toIso8601String();
                }
            }
            $entry = [
                'step_index' => $i,
                'step_order' => $stage['step_order'] ?? $i,
                'step_name' => $stage['step_name'] ?? null,
                'stage_type' => $stage['stage_type'] ?? 'approve',
                'applies' => $applies,
                'completion_rule' => $stage['completion_rule'] ?? 'any',
                'actors' => $actors,
                'actor_reason' => $reason,
                'condition_expression' => $stage['condition_expression'] ?? null,
                'due_at' => $due,
                'governance_body_name' => $stage['governance_body_name'] ?? null,
            ];
            $projected[] = $entry;
            if ($applies) {
                $path[] = $entry['step_order'];
            }
        }

        $result = [
            'simulation_id' => (string) Str::uuid(),
            'stages' => $projected,
            'applicable_path' => $path,
            'created_production_approval' => false,
            'note' => 'Dry-run only — no ApprovalRequest, tasks, or notifications were created.',
        ];

        return WorkflowSimulation::create([
            'tenant_id' => $workflow->tenant_id,
            'workflow_definition_id' => $workflow->id,
            'definition_version_id' => $version?->id,
            'test_context' => $testContext,
            'result' => $result,
            'created_production_approval' => false,
            'simulated_by' => $actor->id,
            'simulated_at' => now(),
        ]);
    }
}
