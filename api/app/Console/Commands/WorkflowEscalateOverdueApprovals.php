<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowEscalation;
use App\Models\WorkflowEngine\WorkflowTask;
use App\Services\NotificationService;
use Illuminate\Console\Command;

/**
 * Notification-only SLA escalation for pending workflow approval steps
 * (PRD Sec 39). This command NEVER changes an ApprovalRequest's status,
 * reassigns a step, or grants any approval — "escalation must never mean
 * auto-approval". It only sends reminders/escalation alerts and records a
 * WorkflowEscalation audit row for visibility. Modelled on the existing
 * AssignmentsProcessReminders / CorrespondenceEscalateDeadlines commands.
 */
class WorkflowEscalateOverdueApprovals extends Command
{
    protected $signature = 'workflow:escalate-overdue';

    protected $description = 'Notify approvers (and escalate to their supervisor) of overdue workflow approval steps. Never reassigns or auto-approves.';

    /** Hours after the first reminder before escalating to the approver's supervisor too. */
    private const ESCALATION_AFTER_HOURS = 24;

    public function handle(NotificationService $notifications): int
    {
        $now = now();

        $overdueTasks = WorkflowTask::query()
            ->with(['assignee', 'approvalRequest.workflow'])
            ->where('status', 'awaiting')
            ->whereNotNull('due_at')
            ->where('due_at', '<', $now)
            ->whereNotNull('assigned_user_id')
            ->get();

        $reminded = 0;
        $escalated = 0;

        foreach ($overdueTasks as $task) {
            $assignee = $task->assignee;
            if (! $assignee || ! $task->approvalRequest) {
                continue;
            }

            $hoursOverdue = $task->due_at->diffInHours($now);
            $shouldEscalate = $task->reminded_at
                && $task->reminded_at->diffInHours($now) >= self::ESCALATION_AFTER_HOURS
                && ! $task->escalated_at;

            try {
                if (! $task->reminded_at) {
                    $this->sendReminder($notifications, $task, $assignee, $hoursOverdue);
                    $task->update(['reminded_at' => $now]);
                    $reminded++;
                } elseif ($shouldEscalate) {
                    $this->sendEscalation($notifications, $task, $assignee, $hoursOverdue);
                    $task->update(['escalated_at' => $now, 'escalation_level' => ($task->escalation_level ?? 0) + 1]);
                    $escalated++;
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $this->info("Sent {$reminded} overdue-approval reminder(s), {$escalated} escalation(s).");

        return self::SUCCESS;
    }

    private function sendReminder(NotificationService $notifications, WorkflowTask $task, User $assignee, int $hoursOverdue): void
    {
        $notifications->dispatch(
            $assignee,
            'workflow.approval_overdue_reminder',
            [
                'name' => $assignee->name,
                'module_label' => $this->moduleLabel($task),
                'reference' => $this->reference($task),
                'hours_overdue' => (string) $hoursOverdue,
            ],
            [
                'module' => 'workflow',
                'record_id' => $task->approval_request_id,
                'url' => '/approvals',
            ]
        );
    }

    private function sendEscalation(NotificationService $notifications, WorkflowTask $task, User $assignee, int $hoursOverdue): void
    {
        // Assignee gets a second, stronger notice.
        $notifications->dispatch(
            $assignee,
            'workflow.approval_overdue_escalated',
            [
                'name' => $assignee->name,
                'module_label' => $this->moduleLabel($task),
                'reference' => $this->reference($task),
                'hours_overdue' => (string) $hoursOverdue,
            ],
            ['module' => 'workflow', 'record_id' => $task->approval_request_id, 'url' => '/approvals']
        );

        $supervisor = $this->supervisorFor($assignee);
        if ($supervisor) {
            $notifications->dispatch(
                $supervisor,
                'workflow.approval_overdue_escalated_to_supervisor',
                [
                    'name' => $supervisor->name,
                    'approver' => $assignee->name,
                    'module_label' => $this->moduleLabel($task),
                    'reference' => $this->reference($task),
                    'hours_overdue' => (string) $hoursOverdue,
                ],
                ['module' => 'workflow', 'record_id' => $task->approval_request_id, 'url' => '/approvals']
            );
        }

        WorkflowEscalation::create([
            'tenant_id' => $task->tenant_id,
            'approval_request_id' => $task->approval_request_id,
            'workflow_task_id' => $task->id,
            'type' => 'sla_breach_notification',
            'from_user_id' => $assignee->id,
            'to_user_id' => $supervisor?->id,
            'reason' => "Approval step overdue by {$hoursOverdue} hour(s); no action taken beyond notification.",
            'level' => ($task->escalation_level ?? 0) + 1,
        ]);
    }

    private function supervisorFor(User $user): ?User
    {
        if (! $user->department_id) {
            return null;
        }

        $dept = Department::with('supervisor')->find($user->department_id);
        while ($dept && ! $dept->supervisor_id) {
            if (! $dept->parent_id) {
                break;
            }
            $dept = Department::with('supervisor')->find($dept->parent_id);
        }

        $supervisor = $dept?->supervisor;

        return ($supervisor && (int) $supervisor->id !== (int) $user->id) ? $supervisor : null;
    }

    private function moduleLabel(WorkflowTask $task): string
    {
        $module = $task->approvalRequest?->workflow?->module_type ?? 'request';

        return ucfirst(str_replace('_', ' ', $module));
    }

    private function reference(WorkflowTask $task): string
    {
        $entity = $task->approvalRequest?->approvable;

        return $entity?->reference_number ?? ('#' . $task->approval_request_id);
    }
}
