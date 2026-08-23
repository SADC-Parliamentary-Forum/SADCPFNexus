<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Models\User;

class LifecycleRbacService
{
    private const CONFIDENTIAL_FIELDS = [
        'salary_details',
        'bank_details',
        'medical_details',
        'exit_interview_notes',
    ];

    private const DEPARTMENT_ROLES = [
        'finance',
        'ict',
        'admin',
        'hr',
        'supervisor',
    ];

    public function canViewCase(User $user, LifecycleCase $case): bool
    {
        if ($user->tenant_id !== $case->tenant_id) {
            return false;
        }

        if ($user->can('lifecycle.admin') || $user->can('lifecycle.view')) {
            return true;
        }

        if ($case->employee_id === $user->id && $user->can('lifecycle.view-own')) {
            return true;
        }

        if (in_array($case->lifecycle_type, ['onboarding', 'transfer', 'promotion', 'probation'], true)
            && $user->can('lifecycle.manage-onboarding')) {
            return true;
        }

        if ($case->lifecycle_type === 'separation' && $user->can('lifecycle.manage-separation')) {
            return true;
        }

        return $user->can('lifecycle.complete-department-tasks');
    }

    public function canCompleteTask(User $user, LifecycleTaskInstance $task): bool
    {
        $case = $task->lifecycleCase;

        if ($user->tenant_id !== $case->tenant_id) {
            return false;
        }

        if ($user->can('lifecycle.admin')) {
            return true;
        }

        $role = $task->assignee_role ?? 'employee';

        if ($role === 'employee') {
            return $case->employee_id === $user->id && $user->can('lifecycle.complete-own-tasks');
        }

        if (in_array($role, self::DEPARTMENT_ROLES, true)) {
            if ($case->employee_id === $user->id && ! $user->can('lifecycle.complete-department-tasks')) {
                return false;
            }

            return $user->can('lifecycle.complete-department-tasks')
                || $user->can('lifecycle.manage-onboarding')
                || $user->can('lifecycle.manage-separation');
        }

        return false;
    }

    public function filterCasePayload(array $payload, User $user): array
    {
        if ($user->can('lifecycle.view-confidential') || $user->can('lifecycle.admin')) {
            return $payload;
        }

        if (isset($payload['confidential']) && is_array($payload['confidential'])) {
            foreach (self::CONFIDENTIAL_FIELDS as $field) {
                unset($payload['confidential'][$field]);
            }
        }

        if (isset($payload['tasks']) && is_array($payload['tasks'])) {
            $payload['tasks'] = array_map(function ($task) use ($user) {
                if (! is_array($task)) {
                    return $task;
                }
                foreach (self::CONFIDENTIAL_FIELDS as $field) {
                    unset($task[$field]);
                }

                return $task;
            }, $payload['tasks']);
        }

        return $payload;
    }

    public function assertViewCase(User $user, LifecycleCase $case): void
    {
        if (! $this->canViewCase($user, $case)) {
            abort(403, 'Not authorised to view this lifecycle case.');
        }
    }

    public function assertCompleteTask(User $user, LifecycleTaskInstance $task): void
    {
        if (! $this->canCompleteTask($user, $task)) {
            abort(403, 'Not authorised to complete this lifecycle task.');
        }
    }
}
