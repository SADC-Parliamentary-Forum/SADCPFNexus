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
 * Paths are evaluated against the module's real condition context.
 */
class WorkflowSimulationService
{
    public function __construct(
        private readonly ActorResolutionService $actors,
        private readonly ConditionEvaluationService $conditions,
        private readonly SlaCalendarService $sla,
        private readonly DefinitionVersionService $definitions,
        private readonly WorkflowSimulationCatalog $catalog,
    ) {}

    /**
     * @return array{modules: list<array<string, mixed>>}
     */
    public function catalogForTenant(int $tenantId): array
    {
        return $this->catalog->forTenant($tenantId);
    }

    public function simulate(
        ApprovalWorkflow $workflow,
        User $actor,
        array $testContext = [],
        ?WorkflowDefinitionVersion $version = null,
        ?User $requester = null,
        ?string $scenarioKey = null
    ): WorkflowSimulation {
        $requester = $requester ?: $actor;
        $moduleType = (string) $workflow->module_type;
        $normalized = $this->catalog->normalize($moduleType, $testContext, $scenarioKey);

        $version = $version ?: $this->definitions->publishedVersionFor($workflow);
        $stages = $version?->stages_snapshot;
        if ($stages === null) {
            $stages = $workflow->steps()->orderBy('step_order')->get()->map(fn (ApprovalStep $s) => $s->toArray())->all();
        }

        $projected = [];
        $path = [];
        $skipped = [];
        foreach (collect($stages)->sortBy('step_order')->values() as $i => $stage) {
            $step = new ApprovalStep($stage);
            $expression = is_array($stage['condition_expression'] ?? null) ? $stage['condition_expression'] : null;
            $matched = $expression ? $this->conditions->evaluate($expression, $normalized) : true;
            $applies = $this->conditions->stageApplies($step, $normalized);
            $skipReason = null;
            if (! $applies) {
                $skipReason = 'condition_not_met';
            } elseif ($expression && ! $matched) {
                $skipReason = 'condition_false_but_required';
            }

            $actors = [];
            $reason = $applies ? 'skipped' : 'stage_not_applicable';
            $due = null;
            if ($applies) {
                try {
                    $resolution = $this->actors->resolve($step, $requester, $normalized);
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
                'condition_matched' => $matched,
                'skip_reason' => $skipReason,
                'condition_summary' => $this->describeExpression($expression),
                'completion_rule' => $stage['completion_rule'] ?? 'any',
                'actors' => $actors,
                'actor_reason' => $reason,
                'condition_expression' => $expression,
                'due_at' => $due,
                'governance_body_name' => $stage['governance_body_name'] ?? null,
            ];
            $projected[] = $entry;
            $pathEntry = [
                'step_order' => $entry['step_order'],
                'step_name' => $entry['step_name'],
                'stage_type' => $entry['stage_type'],
            ];
            if ($applies) {
                $path[] = $pathEntry;
            } else {
                $skipped[] = $pathEntry + ['skip_reason' => $skipReason];
            }
        }

        $result = [
            'simulation_id' => (string) Str::uuid(),
            'module_type' => $moduleType,
            'scenario_key' => $scenarioKey,
            'scenario_label_key' => $this->catalog->scenarioLabelKey($moduleType, $scenarioKey),
            'requester' => [
                'id' => $requester->id,
                'name' => $requester->name,
                'email' => $requester->email,
            ],
            'normalized_context' => $normalized,
            'stages' => $projected,
            'applicable_path' => $path,
            'skipped_path' => $skipped,
            'created_production_approval' => false,
            'note' => 'Dry-run only — no ApprovalRequest, tasks, or notifications were created.',
        ];

        return WorkflowSimulation::create([
            'tenant_id' => $workflow->tenant_id,
            'workflow_definition_id' => $workflow->id,
            'definition_version_id' => $version?->id,
            'test_context' => $normalized,
            'result' => $result,
            'created_production_approval' => false,
            'simulated_by' => $actor->id,
            'simulated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $expression
     */
    private function describeExpression(?array $expression): ?string
    {
        if ($expression === null || $expression === []) {
            return null;
        }
        if (isset($expression['field'])) {
            $value = $expression['value'] ?? null;
            $rendered = is_bool($value) ? ($value ? 'true' : 'false') : (is_scalar($value) ? (string) $value : json_encode($value));

            return $expression['field'].' '.($expression['op'] ?? 'eq').' '.$rendered;
        }

        return json_encode($expression, JSON_UNESCAPED_SLASHES);
    }
}
