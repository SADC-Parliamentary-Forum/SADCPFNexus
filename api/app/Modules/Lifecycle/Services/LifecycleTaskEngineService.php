<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\Assignment;
use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleStageInstance;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Models\User;
use App\Modules\Assignments\Services\AssignmentService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class LifecycleTaskEngineService
{
    public function __construct(
        private readonly AssignmentService $assignments,
    ) {}

    public function spawnFromTemplate(LifecycleCase $case, array $definition, User $actor, array $context = []): void
    {
        $stages = $definition['stages'] ?? [];
        $anchorDate = $this->resolveAnchorDate($case, 'case_start');

        DB::transaction(function () use ($case, $stages, $anchorDate, $actor, $context) {
            foreach ($stages as $index => $stageDef) {
                if (! $this->evaluateCondition($stageDef['condition'] ?? null, $context)) {
                    continue;
                }

                $stage = LifecycleStageInstance::create([
                    'tenant_id' => $case->tenant_id,
                    'case_id' => $case->id,
                    'stage_key' => $stageDef['key'],
                    'name' => $stageDef['name'],
                    'sort_order' => $stageDef['sort_order'] ?? $index,
                    'parallel_group' => $stageDef['parallel_group'] ?? null,
                    'status' => 'active',
                    'started_at' => now(),
                ]);

                foreach ($stageDef['tasks'] ?? [] as $taskDef) {
                    if (! $this->evaluateCondition($taskDef['condition'] ?? null, $context)) {
                        continue;
                    }

                    $dueDate = $this->computeDueDate(
                        $anchorDate,
                        $taskDef['due_offset_days'] ?? null,
                        $taskDef['due_anchor'] ?? 'case_start',
                        $case
                    );

                    $task = LifecycleTaskInstance::create([
                        'tenant_id' => $case->tenant_id,
                        'case_id' => $case->id,
                        'stage_instance_id' => $stage->id,
                        'task_key' => $taskDef['key'],
                        'title' => $taskDef['title'],
                        'description' => $taskDef['description'] ?? null,
                        'assignee_role' => $taskDef['assignee_role'] ?? 'employee',
                        'department_slug' => $taskDef['department_slug'] ?? null,
                        'mandatory' => $taskDef['mandatory'] ?? true,
                        'optional_group' => $taskDef['optional_group'] ?? null,
                        'condition' => $taskDef['condition'] ?? null,
                        'due_date' => $dueDate,
                        'due_offset_days' => $taskDef['due_offset_days'] ?? null,
                        'due_anchor' => $taskDef['due_anchor'] ?? 'case_start',
                        'status' => 'pending',
                        'clearance_status' => $case->lifecycle_type === 'separation' ? 'pending' : null,
                        'evidence_required' => $taskDef['evidence_required'] ?? false,
                    ]);

                    if ($taskDef['spawn_assignment'] ?? true) {
                        $assignment = $this->assignments->createFromSource([
                            'title' => $task->title,
                            'description' => $task->description ?: $task->title,
                            'source_type' => 'lifecycle',
                            'source_id' => $task->id,
                            'source_purpose' => $task->task_key,
                            'source_reference' => $case->reference,
                            'due_date' => $dueDate?->toDateString(),
                            'assigned_to' => ($taskDef['assignee_role'] ?? 'employee') === 'employee'
                                ? $case->employee_id
                                : $actor->id,
                            'department_id' => null,
                            'priority' => ($taskDef['priority'] ?? 'medium'),
                            'status' => 'issued',
                        ], $actor);

                        $task->update(['assignment_id' => $assignment->id]);
                    }
                }
            }
        });
    }

    public function evaluateCondition(?array $condition, array $context): bool
    {
        if ($condition === null || $condition === []) {
            return true;
        }

        $field = $condition['field'] ?? null;
        $operator = $condition['operator'] ?? 'eq';
        $expected = $condition['value'] ?? null;
        $actual = data_get($context, $field);

        return match ($operator) {
            'eq' => $actual == $expected,
            'neq' => $actual != $expected,
            'in' => is_array($expected) && in_array($actual, $expected, true),
            'not_in' => is_array($expected) && ! in_array($actual, $expected, true),
            default => true,
        };
    }

    public function computeDueDate(
        Carbon $caseStart,
        ?int $offsetDays,
        string $anchor,
        LifecycleCase $case
    ): ?Carbon {
        if ($offsetDays === null) {
            return null;
        }

        $base = match ($anchor) {
            'last_working_day' => $case->last_working_day ? Carbon::parse($case->last_working_day) : $caseStart,
            'notice_end' => $case->notice_end_date ? Carbon::parse($case->notice_end_date) : $caseStart,
            default => $caseStart,
        };

        return $base->copy()->addDays($offsetDays);
    }

    private function resolveAnchorDate(LifecycleCase $case, string $anchor): Carbon
    {
        return match ($anchor) {
            'last_working_day' => $case->last_working_day ? Carbon::parse($case->last_working_day) : now(),
            'notice_end' => $case->notice_end_date ? Carbon::parse($case->notice_end_date) : now(),
            default => $case->start_date ? Carbon::parse($case->start_date) : now(),
        };
    }
}
