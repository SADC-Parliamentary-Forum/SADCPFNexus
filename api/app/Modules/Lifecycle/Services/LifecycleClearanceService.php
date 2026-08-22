<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\HrPersonalFile;
use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LifecycleClearanceService
{
    public function __construct(
        private readonly LifecycleEventRecorder $events,
    ) {}

    public function updateClearance(
        LifecycleTaskInstance $task,
        User $actor,
        string $clearanceStatus,
        int $revision
    ): LifecycleTaskInstance {
        if ($task->lifecycleCase->lifecycle_type !== 'separation') {
            throw ValidationException::withMessages(['clearance' => 'Clearance applies to separation cases only.']);
        }

        $this->assertRevision($task, $revision);

        $allowed = ['pending', 'cleared', 'not_cleared'];
        if (! in_array($clearanceStatus, $allowed, true)) {
            throw ValidationException::withMessages(['clearance_status' => 'Invalid clearance status.']);
        }

        if ($clearanceStatus === 'cleared' && $task->clearance_status === 'not_cleared') {
            throw ValidationException::withMessages([
                'clearance_status' => 'Not Cleared cannot be changed to Cleared without an authorised exception.',
            ]);
        }

        return DB::transaction(function () use ($task, $actor, $clearanceStatus) {
            $task->update([
                'clearance_status' => $clearanceStatus,
                'status' => $clearanceStatus === 'cleared' ? 'completed' : $task->status,
                'completed_at' => $clearanceStatus === 'cleared' ? now() : $task->completed_at,
                'completed_by' => $clearanceStatus === 'cleared' ? $actor->id : $task->completed_by,
                'revision' => $task->revision + 1,
            ]);

            $case = $task->lifecycleCase->fresh(['tasks']);
            $this->syncCaseClearance($case);

            $this->events->record($case, 'clearance.updated', $actor, [
                'task_key' => $task->task_key,
                'clearance_status' => $clearanceStatus,
            ]);

            return $task->fresh();
        });
    }

    public function requestException(
        LifecycleTaskInstance $task,
        User $actor,
        string $reason,
        string $exceptionType = 'clearance_override'
    ): \App\Models\Lifecycle\LifecycleException {
        if ($task->clearance_status !== 'not_cleared') {
            throw ValidationException::withMessages(['exception' => 'Exceptions require Not Cleared status first.']);
        }

        return DB::transaction(function () use ($task, $actor, $reason, $exceptionType) {
            $exception = \App\Models\Lifecycle\LifecycleException::create([
                'tenant_id' => $task->tenant_id,
                'case_id' => $task->case_id,
                'task_instance_id' => $task->id,
                'exception_type' => $exceptionType,
                'reason' => $reason,
                'status' => 'pending',
                'created_by' => $actor->id,
            ]);

            $task->update(['clearance_status' => 'exception_pending']);

            $this->events->record($task->lifecycleCase, 'exception.requested', $actor, [
                'task_key' => $task->task_key,
                'exception_id' => $exception->id,
            ]);

            return $exception;
        });
    }

    public function approveException(
        \App\Models\Lifecycle\LifecycleException $exception,
        User $authoriser,
        ?string $notes = null
    ): \App\Models\Lifecycle\LifecycleException {
        if ($exception->status !== 'pending') {
            throw ValidationException::withMessages(['exception' => 'Exception is not pending approval.']);
        }

        return DB::transaction(function () use ($exception, $authoriser, $notes) {
            $exception->update([
                'status' => 'approved',
                'authoriser_id' => $authoriser->id,
                'authorised_at' => now(),
                'resolution_notes' => $notes,
            ]);

            $task = $exception->task;
            if ($task) {
                $task->update([
                    'clearance_status' => 'exception_approved',
                    'status' => 'completed',
                    'completed_at' => now(),
                    'completed_by' => $authoriser->id,
                    'revision' => $task->revision + 1,
                ]);
            }

            $case = $exception->lifecycleCase->fresh(['tasks', 'exceptions']);
            $this->syncCaseClearance($case);

            $this->events->record($case, 'exception.approved', $authoriser, [
                'exception_id' => $exception->id,
                'task_key' => $task?->task_key,
            ]);

            return $exception->fresh();
        });
    }

    public function assertTerminalPaymentAllowed(LifecycleCase $case): void
    {
        if ($case->terminal_payment_blocked) {
            throw ValidationException::withMessages([
                'terminal_payment' => 'Terminal payment is blocked until final clearance is approved.',
            ]);
        }
    }

    public function approveTerminalPayment(LifecycleCase $case, User $actor, int $revision): LifecycleCase
    {
        $this->assertCaseRevision($case, $revision);
        $this->assertTerminalPaymentAllowed($case);

        $case->update([
            'terminal_payment_approved_at' => now(),
            'revision' => $case->revision + 1,
        ]);

        $this->events->record($case, 'terminal_payment.approved', $actor, []);

        return $case->fresh();
    }

    public function syncCaseClearance(LifecycleCase $case): void
    {
        $mandatoryClearance = $case->tasks()
            ->where('mandatory', true)
            ->whereNotNull('clearance_status')
            ->get();

        $allResolved = $mandatoryClearance->every(function (LifecycleTaskInstance $task) {
            return in_array($task->clearance_status, ['cleared', 'exception_approved'], true);
        });

        $anyNotCleared = $mandatoryClearance->contains(fn ($t) => $t->clearance_status === 'not_cleared');

        $case->update([
            'clearance_status' => $anyNotCleared ? 'incomplete' : ($allResolved ? 'cleared' : 'in_progress'),
            'terminal_payment_blocked' => ! $allResolved,
        ]);
    }

    private function assertRevision(LifecycleTaskInstance $task, int $revision): void
    {
        if ((int) $task->revision !== $revision) {
            abort(409, 'Task was modified by another user. Refresh and retry.');
        }
    }

    private function assertCaseRevision(LifecycleCase $case, int $revision): void
    {
        if ((int) $case->revision !== $revision) {
            abort(409, 'Case was modified by another user. Refresh and retry.');
        }
    }
}
