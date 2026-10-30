<?php

namespace App\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
use App\Models\Assignment;
use App\Models\User;
use App\Modules\Correspondence\Services\CorrespondenceRegisterService;
use App\Modules\Lifecycle\Services\LifecycleCaseService;
use App\Modules\WorkflowEngine\Services\WorkflowOrchestrator;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * "Needs my action": one view over the per-module queues that already exist.
 * Every source is the module's own user-scoped query, so an item appears only
 * when the module itself would show it to this user:
 *  - approvals       — engine tasks assigned to the user (WorkflowOrchestrator::inbox)
 *  - corrections     — the user's own requests returned for correction
 *  - assignments     — open assignments assigned to the user
 *  - lifecycle       — onboarding/separation tasks the user may complete
 *  - correspondence  — open items the user owns (accessibleQuery-scoped)
 * A failing source is reported in `sources` and never hides the others.
 */
class ActionQueueService
{
    private const ASSIGNMENT_DONE = ['completed', 'closed', 'cancelled', 'draft', 'archived'];

    public function __construct(
        private readonly WorkflowOrchestrator $orchestrator,
        private readonly LifecycleCaseService $lifecycle,
        private readonly CorrespondenceRegisterService $correspondence,
    ) {}

    /** @return array{data: list<array<string, mixed>>, counts: array<string, int>, sources: array<string, string>} */
    public function forUser(User $user): array
    {
        $items = [];
        $sources = [];

        foreach ([
            'approvals' => fn () => $this->approvals($user),
            'corrections' => fn () => $this->corrections($user),
            'assignments' => fn () => $this->assignments($user),
            'lifecycle' => fn () => $this->lifecycleTasks($user),
            'correspondence' => fn () => $this->correspondenceActions($user),
        ] as $source => $load) {
            try {
                $loaded = $load();
                $sources[$source] = $loaded === null ? 'not_permitted' : 'ok';
                array_push($items, ...($loaded ?? []));
            } catch (Throwable $e) {
                report($e);
                $sources[$source] = 'unavailable';
            }
        }

        // Overdue first, then soonest due, undated last.
        usort($items, fn (array $a, array $b) => [$b['overdue'], $a['due_at'] === null, $a['due_at']]
            <=> [$a['overdue'], $b['due_at'] === null, $b['due_at']]);

        $counts = ['total' => count($items), 'overdue' => count(array_filter($items, fn ($i) => $i['overdue']))];
        foreach ($items as $item) {
            $counts[$item['kind']] = ($counts[$item['kind']] ?? 0) + 1;
        }

        return ['data' => array_values($items), 'counts' => $counts, 'sources' => $sources];
    }

    private function approvals(User $user): array
    {
        $items = [];
        foreach ($this->orchestrator->inbox($user, ['status' => 'awaiting']) as $task) {
            $request = $task->approvalRequest;
            $entity = $request?->approvable;
            $items[] = $this->item(
                kind: 'approval',
                id: 'approval-task-'.$task->id,
                title: $this->entityTitle($entity) ?? 'Approval request',
                reference: $entity->reference_number ?? null,
                module: $request?->workflow?->module_type,
                recordId: $request?->approvable_id,
                path: null,
                dueAt: $task->due_at,
                action: $task->stage_type ?? 'approve',
                blocker: null,
            );
        }

        return $items;
    }

    /** The user's own requests sent back to them — they hold the next step. */
    private function corrections(User $user): array
    {
        $items = [];
        $returned = ApprovalRequest::query()
            ->with(['workflow', 'approvable'])
            ->where('tenant_id', $user->tenant_id)
            ->where('status', 'returned')
            ->latest('updated_at')
            ->limit(100)
            ->get();

        foreach ($returned as $request) {
            $entity = $request->approvable;
            if (! $entity || ! $this->isRequester($entity, $user)) {
                continue;
            }
            $reason = ApprovalHistory::where('approval_request_id', $request->id)
                ->where('action', 'return')
                ->latest('id')
                ->value('comment');
            $items[] = $this->item(
                kind: 'correction',
                id: 'correction-'.$request->id,
                title: $this->entityTitle($entity) ?? 'Returned request',
                reference: $entity->reference_number ?? null,
                module: $request->workflow?->module_type,
                recordId: $request->approvable_id,
                path: null,
                dueAt: null,
                action: 'resubmit',
                blocker: $reason ? 'Returned for correction: '.$reason : 'Returned for correction',
            );
        }

        return $items;
    }

    private function assignments(User $user): array
    {
        return Assignment::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('assigned_to', $user->id)
            ->whereNotIn('status', self::ASSIGNMENT_DONE)
            ->orderByRaw('due_date IS NULL, due_date ASC')
            ->limit(100)
            ->get()
            ->map(fn (Assignment $a) => $this->item(
                kind: 'assignment',
                id: 'assignment-'.$a->id,
                title: (string) $a->title,
                reference: $a->reference_number,
                module: 'assignments',
                recordId: $a->id,
                path: '/assignments/'.$a->id,
                dueAt: $a->due_date,
                action: $a->status === 'awaiting_acceptance' ? 'accept' : 'complete',
                blocker: $a->status === 'blocked' ? 'Marked as blocked' : null,
            ))
            ->all();
    }

    private function lifecycleTasks(User $user): array
    {
        return array_map(fn (array $t) => $this->item(
            kind: 'lifecycle',
            id: 'lifecycle-task-'.($t['id'] ?? uniqid()),
            title: (string) ($t['title'] ?? $t['name'] ?? 'Lifecycle task'),
            reference: $t['case_reference'] ?? null,
            module: 'lifecycle',
            recordId: $t['id'] ?? null,
            path: '/lifecycle/my-tasks',
            dueAt: $t['due_date'] ?? null,
            action: 'complete',
            blocker: null,
        ), $this->lifecycle->myTasks($user));
    }

    /** @return list<array<string, mixed>>|null null when the user lacks correspondence access */
    private function correspondenceActions(User $user): ?array
    {
        if (! $user->isSystemAdmin() && ! $user->hasAnyPermission(['correspondence.view'])) {
            return null;
        }

        return collect($this->correspondence->myActions($user, ['per_page' => 50])->items())
            ->map(fn ($c) => $this->item(
                kind: 'correspondence',
                id: 'correspondence-'.$c->id,
                title: (string) ($c->subject ?? $c->title ?? 'Correspondence'),
                reference: $c->reference_number ?? $c->reference ?? null,
                module: 'correspondence',
                recordId: $c->id,
                path: '/correspondence/'.$c->id,
                dueAt: $c->final_deadline ?? null,
                action: 'respond',
                blocker: null,
            ))
            ->all();
    }

    private function item(
        string $kind,
        string $id,
        string $title,
        ?string $reference,
        ?string $module,
        mixed $recordId,
        ?string $path,
        mixed $dueAt,
        string $action,
        ?string $blocker,
    ): array {
        $due = $dueAt ? Carbon::parse($dueAt) : null;

        return [
            'id' => $id,
            'kind' => $kind,
            'title' => $title,
            'reference' => $reference,
            'module' => $module,
            'record_id' => $recordId !== null ? (int) $recordId : null,
            'path' => $path,
            'due_at' => $due?->toIso8601String(),
            'overdue' => $due !== null && $due->isPast(),
            'action' => $action,
            // Every item in this queue is, by construction, waiting on the viewer.
            'next_step_owner' => 'you',
            'blocker' => $blocker,
        ];
    }

    private function entityTitle(mixed $entity): ?string
    {
        if (! $entity) {
            return null;
        }

        foreach (['title', 'subject', 'purpose', 'name', 'reference_number'] as $field) {
            $value = $entity->{$field} ?? null;
            if (is_string($value) && trim($value) !== '') {
                return $value;
            }
        }

        return class_basename($entity).' #'.$entity->getKey();
    }

    private function isRequester(mixed $entity, User $user): bool
    {
        $id = $entity->requester_id ?? $entity->prepared_by ?? $entity->created_by ?? $entity->submitted_by ?? null;

        return $id !== null && (int) $id === (int) $user->id;
    }
}
