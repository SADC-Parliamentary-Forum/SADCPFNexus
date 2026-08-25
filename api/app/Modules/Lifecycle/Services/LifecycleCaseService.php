<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\HrPersonalFile;
use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Models\User;
use App\Services\WorkflowService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LifecycleCaseService
{
    public function __construct(
        private readonly NoticeRuleService $noticeRules,
        private readonly LifecycleTemplateService $templates,
        private readonly LifecycleTaskEngineService $taskEngine,
        private readonly LifecycleEventRecorder $events,
        private readonly LifecycleRbacService $rbac,
        private readonly LifecycleClearanceService $clearance,
        private readonly WorkflowService $workflow,
    ) {}

    public function initiateOnboarding(User $actor, array $data): LifecycleCase
    {
        $employee = User::where('tenant_id', $actor->tenant_id)->findOrFail($data['employee_id']);

        $templateCode = $data['template_code'] ?? 'onboarding-local';
        $version = isset($data['template_version_id'])
            ? \App\Models\Lifecycle\LifecycleJourneyTemplateVersion::where('tenant_id', $actor->tenant_id)
                ->where('id', $data['template_version_id'])
                ->where('status', 'published')
                ->firstOrFail()
            : $this->templates->resolvePublishedVersion($actor, $templateCode, 'onboarding');

        $hrFile = HrPersonalFile::where('tenant_id', $actor->tenant_id)
            ->where('employee_id', $employee->id)
            ->first();

        $context = [
            'employment_category' => $data['employment_category'] ?? $hrFile?->contract_type ?? 'local',
            'employee_category' => $data['employee_category'] ?? $data['employment_category'] ?? 'local',
        ];

        return DB::transaction(function () use ($actor, $employee, $version, $data, $hrFile, $context) {
            $case = LifecycleCase::create([
                'tenant_id' => $actor->tenant_id,
                'reference' => $this->nextReference('ONB'),
                'employee_id' => $employee->id,
                'person_id' => $data['person_id'] ?? null,
                'hr_file_id' => $hrFile?->id,
                'lifecycle_type' => 'onboarding',
                'template_version_id' => $version->id,
                'status' => 'in_progress',
                'start_date' => $data['start_date'] ?? now()->toDateString(),
                'target_start_date' => $data['target_start_date'] ?? null,
                'readiness' => [
                    'employee_tasks_complete' => false,
                    'department_tasks_complete' => false,
                    'ready' => false,
                ],
                'created_by' => $actor->id,
            ]);

            $this->taskEngine->spawnFromTemplate($case, $version->definition, $actor, $context);
            $this->events->record($case, 'case.initiated', $actor, [
                'lifecycle_type' => 'onboarding',
                'template_version_id' => $version->id,
            ]);

            if ($data['initiate_appointment_workflow'] ?? false) {
                $this->workflow->initiate($case, 'lifecycle_appointment_authorise', $actor);
            }

            return $case->fresh(['stages.tasks', 'employee', 'templateVersion']);
        });
    }

    public function initiateSeparation(User $actor, array $data): LifecycleCase
    {
        $employee = User::where('tenant_id', $actor->tenant_id)->findOrFail($data['employee_id']);

        $templateCode = $data['template_code'] ?? match ($data['separation_reason'] ?? 'resignation') {
            'end_of_contract' => 'separation-end-of-contract',
            default => 'separation-resignation',
        };

        $version = isset($data['template_version_id'])
            ? \App\Models\Lifecycle\LifecycleJourneyTemplateVersion::where('tenant_id', $actor->tenant_id)
                ->where('id', $data['template_version_id'])
                ->where('status', 'published')
                ->firstOrFail()
            : $this->templates->resolvePublishedVersion($actor, $templateCode, 'separation');

        $noticeSnapshot = $this->noticeRules->resolve(
            $employee,
            $data['grade_band_id'] ?? null,
            $data['contract_type_id'] ?? null
        );

        $initiatedAt = Carbon::parse($data['initiated_at'] ?? now());
        $noticeEnd = $this->noticeRules->noticeEndDate($initiatedAt, $noticeSnapshot);

        $hrFile = HrPersonalFile::where('tenant_id', $actor->tenant_id)
            ->where('employee_id', $employee->id)
            ->first();

        return DB::transaction(function () use (
            $actor, $employee, $version, $data, $noticeSnapshot, $noticeEnd, $hrFile, $initiatedAt
        ) {
            $case = LifecycleCase::create([
                'tenant_id' => $actor->tenant_id,
                'reference' => $this->nextReference('SEP'),
                'employee_id' => $employee->id,
                'person_id' => $data['person_id'] ?? null,
                'hr_file_id' => $hrFile?->id,
                'lifecycle_type' => 'separation',
                'template_version_id' => $version->id,
                'status' => 'in_progress',
                'separation_reason' => $data['separation_reason'] ?? 'resignation',
                'start_date' => $initiatedAt->toDateString(),
                'last_working_day' => $data['last_working_day'] ?? null,
                'notice_end_date' => $noticeEnd->toDateString(),
                'notice_snapshot' => $noticeSnapshot,
                'clearance_status' => 'in_progress',
                'terminal_payment_blocked' => true,
                'created_by' => $actor->id,
            ]);

            $context = [
                'separation_reason' => $case->separation_reason,
                'employment_category' => $data['employment_category'] ?? $hrFile?->contract_type ?? 'local',
            ];

            $this->taskEngine->spawnFromTemplate($case, $version->definition, $actor, $context);
            $this->events->record($case, 'case.initiated', $actor, [
                'lifecycle_type' => 'separation',
                'notice_snapshot' => $noticeSnapshot,
            ]);

            return $case->fresh(['stages.tasks', 'employee', 'templateVersion']);
        });
    }

    public function initiateInternal(User $actor, string $lifecycleType, array $data): LifecycleCase
    {
        if (! in_array($lifecycleType, ['transfer', 'promotion', 'probation'], true)) {
            throw ValidationException::withMessages(['lifecycle_type' => 'Unsupported journey type.']);
        }

        $employee = User::where('tenant_id', $actor->tenant_id)->findOrFail($data['employee_id']);

        $defaultCodes = [
            'transfer' => 'transfer-internal',
            'promotion' => 'promotion',
            'probation' => 'probation-review',
        ];
        $prefixes = [
            'transfer' => 'TRF',
            'promotion' => 'PRM',
            'probation' => 'PRB',
        ];

        $templateCode = $data['template_code'] ?? $defaultCodes[$lifecycleType];
        $version = isset($data['template_version_id'])
            ? \App\Models\Lifecycle\LifecycleJourneyTemplateVersion::where('tenant_id', $actor->tenant_id)
                ->where('id', $data['template_version_id'])
                ->where('status', 'published')
                ->firstOrFail()
            : $this->templates->resolvePublishedVersion($actor, $templateCode, $lifecycleType);

        $hrFile = HrPersonalFile::where('tenant_id', $actor->tenant_id)
            ->where('employee_id', $employee->id)
            ->first();

        return DB::transaction(function () use ($actor, $employee, $version, $data, $hrFile, $lifecycleType, $prefixes) {
            $case = LifecycleCase::create([
                'tenant_id' => $actor->tenant_id,
                'reference' => $this->nextReference($prefixes[$lifecycleType]),
                'employee_id' => $employee->id,
                'person_id' => $data['person_id'] ?? null,
                'hr_file_id' => $hrFile?->id,
                'lifecycle_type' => $lifecycleType,
                'template_version_id' => $version->id,
                'status' => 'in_progress',
                'start_date' => $data['start_date'] ?? now()->toDateString(),
                'readiness' => [
                    'employee_tasks_complete' => false,
                    'department_tasks_complete' => false,
                    'ready' => false,
                ],
                'created_by' => $actor->id,
            ]);

            $this->taskEngine->spawnFromTemplate($case, $version->definition, $actor, [
                'lifecycle_type' => $lifecycleType,
            ]);
            $this->events->record($case, 'case.initiated', $actor, [
                'lifecycle_type' => $lifecycleType,
                'template_version_id' => $version->id,
            ]);

            return $case->fresh(['stages.tasks', 'employee', 'templateVersion']);
        });
    }

    public function show(LifecycleCase $case, User $viewer): array
    {
        $this->rbac->assertViewCase($viewer, $case);

        $case->load([
            'employee',
            'stages.tasks',
            'templateVersion.template',
            'exceptions',
            'events' => fn ($q) => $q->latest('created_at'),
        ]);

        $payload = [
            'id' => $case->id,
            'reference' => $case->reference,
            'lifecycle_type' => $case->lifecycle_type,
            'status' => $case->status,
            'employee' => $case->employee ? ['id' => $case->employee->id, 'name' => $case->employee->name] : null,
            'start_date' => $case->start_date?->toDateString(),
            'target_start_date' => $case->target_start_date?->toDateString(),
            'last_working_day' => $case->last_working_day?->toDateString(),
            'notice_end_date' => $case->notice_end_date?->toDateString(),
            'notice_snapshot' => $case->notice_snapshot,
            'readiness' => $case->readiness,
            'clearance_status' => $case->clearance_status,
            'terminal_payment_blocked' => $case->terminal_payment_blocked,
            'terminal_payment_approved_at' => $case->terminal_payment_approved_at?->toIso8601String(),
            'exceptions' => $case->exceptions->map(fn ($e) => [
                'id' => $e->id,
                'task_instance_id' => $e->task_instance_id,
                'exception_type' => $e->exception_type,
                'reason' => $e->reason,
                'status' => $e->status,
                'resolution_notes' => $e->resolution_notes,
            ])->values(),
            'revision' => $case->revision,
            'template' => [
                'code' => $case->templateVersion?->template?->code,
                'version_number' => $case->templateVersion?->version_number,
            ],
            'stages' => $case->stages->map(fn ($s) => [
                'id' => $s->id,
                'stage_key' => $s->stage_key,
                'name' => $s->name,
                'status' => $s->status,
                'parallel_group' => $s->parallel_group,
                'tasks' => $s->tasks->map(fn ($t) => $this->taskPayload($t))->values(),
            ])->values(),
            'confidential' => [
                'salary_details' => $case->notice_snapshot['salary_details'] ?? null,
                'bank_details' => null,
                'medical_details' => null,
                'exit_interview_notes' => null,
            ],
        ];

        return $this->rbac->filterCasePayload($payload, $viewer);
    }

    public function timeline(LifecycleCase $case, User $viewer): array
    {
        $this->rbac->assertViewCase($viewer, $case);

        return $case->events()
            ->with('actor:id,name')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'event_type' => $e->event_type,
                'actor' => $e->actor?->name,
                'payload' => $e->payload,
                'created_at' => $e->created_at?->toIso8601String(),
            ])
            ->all();
    }

    public function completeTask(LifecycleTaskInstance $task, User $actor, int $revision): LifecycleTaskInstance
    {
        $this->rbac->assertCompleteTask($actor, $task);
        $this->assertTaskRevision($task, $revision);

        if ($task->status === 'completed') {
            return $task;
        }

        if ($task->evidence_required && $task->evidence()->count() === 0) {
            throw ValidationException::withMessages(['evidence' => 'Evidence is required before completing this task.']);
        }

        return DB::transaction(function () use ($task, $actor) {
            $task->update([
                'status' => 'completed',
                'completed_at' => now(),
                'completed_by' => $actor->id,
                'revision' => $task->revision + 1,
            ]);

            if ($task->lifecycleCase->lifecycle_type === 'separation' && $task->clearance_status === 'pending') {
                $task->update(['clearance_status' => 'cleared']);
                $this->clearance->syncCaseClearance($task->lifecycleCase);
            }

            $case = $task->lifecycleCase;
            $this->recalculateReadiness($case);
            $this->maybeCompleteInternal($case, $actor);
            $this->events->record($case->fresh(), 'task.completed', $actor, ['task_key' => $task->task_key]);

            return $task->fresh();
        });
    }

    public function reopenTask(LifecycleTaskInstance $task, User $actor, int $revision): LifecycleTaskInstance
    {
        if (! $actor->can('lifecycle.admin') && ! $actor->can('lifecycle.manage-onboarding') && ! $actor->can('lifecycle.manage-separation')) {
            abort(403);
        }

        $this->assertTaskRevision($task, $revision);

        return DB::transaction(function () use ($task, $actor) {
            $task->update([
                'status' => 'pending',
                'completed_at' => null,
                'completed_by' => null,
                'revision' => $task->revision + 1,
            ]);

            $this->recalculateReadiness($task->lifecycleCase);
            $this->reopenInternalIfCompleted($task->lifecycleCase, $actor);
            $this->events->record($task->lifecycleCase, 'task.reopened', $actor, ['task_key' => $task->task_key]);

            return $task->fresh();
        });
    }

    public function dashboard(User $user): array
    {
        $base = LifecycleCase::where('tenant_id', $user->tenant_id);

        return [
            'onboarding_open' => (clone $base)->where('lifecycle_type', 'onboarding')->where('status', 'in_progress')->count(),
            'separation_open' => (clone $base)->where('lifecycle_type', 'separation')->where('status', 'in_progress')->count(),
            'internal_open' => (clone $base)->whereIn('lifecycle_type', ['transfer', 'promotion', 'probation'])
                ->where('status', 'in_progress')->count(),
            'awaiting_clearance' => (clone $base)->where('lifecycle_type', 'separation')
                ->where('terminal_payment_blocked', true)->count(),
            'ready_onboarding' => (clone $base)->where('lifecycle_type', 'onboarding')
                ->whereJsonContains('readiness->ready', true)->count(),
        ];
    }

    public function listCases(User $user, array $filters = []): array
    {
        $q = LifecycleCase::with('employee:id,name')
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at');

        if (! empty($filters['lifecycle_type'])) {
            $q->where('lifecycle_type', $filters['lifecycle_type']);
        }

        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        if (! $user->can('lifecycle.view') && ! $user->can('lifecycle.admin')) {
            if ($user->can('lifecycle.view-own')) {
                $q->where('employee_id', $user->id);
            }
        }

        return $q->limit(100)->get()->map(fn ($c) => [
            'id' => $c->id,
            'reference' => $c->reference,
            'lifecycle_type' => $c->lifecycle_type,
            'status' => $c->status,
            'employee_name' => $c->employee?->name,
            'start_date' => $c->start_date?->toDateString(),
            'readiness' => $c->readiness,
            'clearance_status' => $c->clearance_status,
        ])->all();
    }

    public function myTasks(User $user): array
    {
        $tasks = LifecycleTaskInstance::with(['lifecycleCase.employee:id,name'])
            ->where('tenant_id', $user->tenant_id)
            ->where('status', '!=', 'completed')
            ->whereHas('lifecycleCase', function ($q) {
                $q->where('status', 'in_progress');
            })
            ->orderBy('due_date')
            ->limit(100)
            ->get();

        return $tasks->filter(fn ($t) => $this->rbac->canCompleteTask($user, $t))
            ->map(fn ($t) => array_merge($this->taskPayload($t), [
                'case_reference' => $t->lifecycleCase->reference,
                'employee_name' => $t->lifecycleCase->employee?->name,
            ]))
            ->values()
            ->all();
    }

    public function recalculateReadiness(LifecycleCase $case): void
    {
        if ($case->lifecycle_type !== 'onboarding') {
            return;
        }

        $tasks = $case->tasks()->get();
        $employeeTasks = $tasks->filter(fn ($t) => ($t->assignee_role ?? 'employee') === 'employee');
        $deptTasks = $tasks->filter(fn ($t) => ($t->assignee_role ?? 'employee') !== 'employee');

        $employeeMandatory = $employeeTasks->where('mandatory', true);
        $deptMandatory = $deptTasks->where('mandatory', true);

        $employeeComplete = $employeeMandatory->isEmpty()
            || $employeeMandatory->every(fn ($t) => $t->status === 'completed');
        $deptComplete = $deptMandatory->isEmpty()
            || $deptMandatory->every(fn ($t) => $t->status === 'completed');

        $optionalGroups = $tasks->where('mandatory', false)->groupBy('optional_group');
        $optionalSatisfied = $optionalGroups->every(function ($group) {
            if ($group->isEmpty()) {
                return true;
            }
            // At least one optional in each group must be complete if group exists
            return $group->contains(fn ($t) => $t->status === 'completed') || $group->every(fn ($t) => $t->status === 'pending');
        });

        $ready = $employeeComplete && $deptComplete && $optionalSatisfied;

        $case->update([
            'readiness' => [
                'employee_tasks_complete' => $employeeComplete,
                'department_tasks_complete' => $deptComplete,
                'ready' => $ready,
            ],
        ]);
    }

    public function finaliseSeparation(LifecycleCase $case, User $actor, int $revision): LifecycleCase
    {
        if ($case->lifecycle_type !== 'separation') {
            throw ValidationException::withMessages(['case' => 'Only separation cases can be finalised.']);
        }

        if ((int) $case->revision !== $revision) {
            abort(409, 'Case was modified by another user. Refresh and retry.');
        }

        if ($case->terminal_payment_blocked) {
            throw ValidationException::withMessages(['clearance' => 'All mandatory clearances must be resolved before finalising.']);
        }

        $case->update([
            'status' => 'completed',
            'completed_at' => now(),
            'revision' => $case->revision + 1,
        ]);

        $this->events->record($case, 'case.finalised', $actor, []);

        return $case->fresh();
    }

    private function taskPayload(LifecycleTaskInstance $task): array
    {
        return [
            'id' => $task->id,
            'case_id' => $task->case_id,
            'task_key' => $task->task_key,
            'title' => $task->title,
            'assignee_role' => $task->assignee_role,
            'department_slug' => $task->department_slug,
            'mandatory' => $task->mandatory,
            'optional_group' => $task->optional_group,
            'status' => $task->status,
            'clearance_status' => $task->clearance_status,
            'due_date' => $task->due_date?->toDateString(),
            'assignment_id' => $task->assignment_id,
            'revision' => $task->revision,
        ];
    }

    private function maybeCompleteInternal(LifecycleCase $case, User $actor): void
    {
        $case->refresh();
        if (! in_array($case->lifecycle_type, ['transfer', 'promotion', 'probation'], true)) {
            return;
        }
        if ($case->status !== 'in_progress') {
            return;
        }

        $mandatory = $case->tasks()->where('mandatory', true)->get();
        if ($mandatory->isEmpty() || $mandatory->contains(fn ($t) => $t->status !== 'completed')) {
            return;
        }

        $case->update([
            'status' => 'completed',
            'completed_at' => now(),
            'revision' => $case->revision + 1,
        ]);
        $this->events->record($case, 'case.completed', $actor, [
            'lifecycle_type' => $case->lifecycle_type,
        ]);
    }

    private function reopenInternalIfCompleted(LifecycleCase $case, User $actor): void
    {
        $case->refresh();
        if (! in_array($case->lifecycle_type, ['transfer', 'promotion', 'probation'], true)) {
            return;
        }
        if ($case->status !== 'completed') {
            return;
        }

        $case->update([
            'status' => 'in_progress',
            'completed_at' => null,
            'revision' => $case->revision + 1,
        ]);
        $this->events->record($case, 'case.reopened', $actor, [
            'lifecycle_type' => $case->lifecycle_type,
        ]);
    }

    private function nextReference(string $prefix): string
    {
        return $prefix.'-'.strtoupper(Str::random(6));
    }

    private function assertTaskRevision(LifecycleTaskInstance $task, int $revision): void
    {
        if ((int) $task->revision !== $revision) {
            abort(409, 'Task was modified by another user. Refresh and retry.');
        }
    }
}
