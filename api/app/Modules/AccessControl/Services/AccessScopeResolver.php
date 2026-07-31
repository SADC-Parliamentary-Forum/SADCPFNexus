<?php

namespace App\Modules\AccessControl\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Explicit scope checks (PRD §6.5). Deny-by-default when a resource is supplied
 * and the actor has no matching scope claim.
 */
class AccessScopeResolver
{
    public function allows(
        User $actor,
        string $permission,
        mixed $resource = null,
        array $context = [],
        ?string $grantScope = null,
    ): bool {
        if ($resource === null && empty($context['require_scope'])) {
            return true;
        }

        $required = $context['scope'] ?? $grantScope ?? $this->inferScopeFromPermission($permission);

        return match ($required) {
            'self', 'created' => $this->owns($actor, $resource, $context),
            'assigned', 'workflow_stage', 'specific_records' => $this->isAssigned($actor, $resource, $context),
            'direct_reports', 'reporting_tree' => $this->isDirectReport($actor, $resource, $context),
            'department' => $this->sameDepartment($actor, $resource, $context),
            'organisation', 'system', 'directorate', 'project', 'programme' => true,
            default => $this->owns($actor, $resource, $context)
                || $this->isAssigned($actor, $resource, $context)
                || (bool) ($context['elevated'] ?? false),
        };
    }

    /**
     * Apply deny-by-default list scoping for high-risk modules.
     *
     * @param  array{
     *     organisation?: bool,
     *     elevated?: bool,
     *     module?: string,
     *     department_column?: string,
     *     owner_columns?: list<string>
     * }  $options
     */
    public function constrainQuery(Builder $query, User $actor, string $ownerColumn = 'requester_id', array $options = []): Builder
    {
        if (! empty($options['organisation']) || $actor->can('system.admin') || $actor->hasRole('System Admin')) {
            // Still not a blank cheque for business data for pure ICT — callers should pass elevated explicitly.
            if (! empty($options['elevated']) || $this->hasElevatedListAccess($actor, $options['module'] ?? null)) {
                return $query;
            }
        }

        if ($this->hasElevatedListAccess($actor, $options['module'] ?? null)) {
            if (! empty($options['department_column']) && $actor->department_id) {
                return $query->where($options['department_column'], $actor->department_id);
            }

            return $query;
        }

        $ownerColumns = $options['owner_columns'] ?? [$ownerColumn];

        // Deny-by-default: own records (and optional alternate owner columns) only.
        return $query->where(function (Builder $q) use ($actor, $ownerColumns) {
            foreach (array_values($ownerColumns) as $i => $col) {
                if ($i === 0) {
                    $q->where($col, $actor->id);
                } else {
                    $q->orWhere($col, $actor->id);
                }
            }
        });
    }

    private function hasElevatedListAccess(User $actor, ?string $module): bool
    {
        $map = [
            'leave' => ['leave.approve', 'leave.admin', 'leave.request.read.direct_reports', 'leave.request.authorise.assigned', 'hr.admin'],
            'procurement' => ['procurement.approve', 'procurement.admin', 'procurement.request.read.assigned', 'procurement.award.approve.assigned'],
            'programme' => ['pif.approve', 'pif.admin', 'programme.finance-review', 'programme.finance_review.update.assigned', 'programme.request.read.assigned'],
            'salary_advance' => ['salary_advance.certify', 'salary_advance.approve', 'salary_advance.admin', 'salary_advance.finance_certify.assigned', 'finance.approve'],
            'travel' => [
                'travel.approve', 'travel.admin', 'travel.finance-review', 'travel.admin-review',
                'travel.director-finance-confirm', 'travel.final-approve', 'travel.export',
            ],
        ];

        foreach ($map[$module] ?? [] as $perm) {
            if ($actor->can($perm)) {
                return true;
            }
        }

        $roleMap = [
            'leave' => ['HR Manager', 'HR Administrator', 'Secretary General', 'Director', 'HOD', 'Internal Auditor'],
            'procurement' => ['Procurement Officer', 'Secretary General', 'Director', 'HOD', 'Internal Auditor'],
            'programme' => ['Finance Controller', 'Secretary General', 'Director', 'Internal Auditor'],
            'salary_advance' => ['Finance Controller', 'Secretary General', 'Director', 'Internal Auditor'],
            'travel' => [
                'Secretary General', 'HR Manager', 'Finance Controller', 'Director',
                'Administration Officer', 'HOD', 'Internal Auditor',
            ],
        ];

        return $actor->hasAnyRole($roleMap[$module] ?? [
            'HR Manager', 'HR Administrator', 'Finance Controller', 'Secretary General',
            'Procurement Officer', 'Director', 'HOD', 'Internal Auditor',
        ]);
    }

    private function inferScopeFromPermission(string $permission): string
    {
        $parts = explode('.', $permission);
        $last = end($parts) ?: 'self';

        return in_array($last, config('access_control.scopes', []), true) ? $last : 'self';
    }

    private function owns(User $actor, mixed $resource, array $context): bool
    {
        if (isset($context['owner_id'])) {
            return (int) $context['owner_id'] === (int) $actor->id;
        }

        if (! $resource instanceof Model) {
            return false;
        }

        foreach (['requester_id', 'created_by', 'user_id', 'applicant_id'] as $col) {
            if ($resource->getAttribute($col) !== null) {
                return (int) $resource->getAttribute($col) === (int) $actor->id;
            }
        }

        return false;
    }

    private function isAssigned(User $actor, mixed $resource, array $context): bool
    {
        if (! empty($context['assignee_ids']) && in_array((int) $actor->id, array_map('intval', $context['assignee_ids']), true)) {
            return true;
        }

        if ($resource instanceof Model) {
            foreach (['assigned_to', 'assignee_id', 'current_approver_id'] as $col) {
                if ($resource->getAttribute($col) !== null && (int) $resource->getAttribute($col) === (int) $actor->id) {
                    return true;
                }
            }
        }

        return (bool) ($context['assigned'] ?? false);
    }

    private function isDirectReport(User $actor, mixed $resource, array $context): bool
    {
        if (! empty($context['is_direct_report'])) {
            return true;
        }

        $ownerId = $context['owner_id'] ?? null;
        if ($resource instanceof Model) {
            $ownerId = $resource->getAttribute('requester_id')
                ?? $resource->getAttribute('user_id')
                ?? $ownerId;
        }

        if (! $ownerId) {
            return false;
        }

        // Lightweight fallback: same department counts as reporting proximity when PA graph unavailable.
        $owner = User::query()->find($ownerId);
        if (! $owner) {
            return false;
        }

        return $actor->department_id && $owner->department_id && (int) $actor->department_id === (int) $owner->department_id;
    }

    private function sameDepartment(User $actor, mixed $resource, array $context): bool
    {
        if (! $actor->department_id) {
            return false;
        }

        if (isset($context['department_id'])) {
            return (int) $context['department_id'] === (int) $actor->department_id;
        }

        if ($resource instanceof Model && $resource->getAttribute('department_id') !== null) {
            return (int) $resource->getAttribute('department_id') === (int) $actor->department_id;
        }

        return $this->isDirectReport($actor, $resource, $context);
    }
}
