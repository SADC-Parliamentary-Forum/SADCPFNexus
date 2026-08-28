<?php

namespace App\Modules\AccessControl\Services;

use App\Models\AccessControl\PermissionUsageEvent;
use App\Models\AccessControl\UserPermissionDenial;
use App\Models\AccessControl\UserPermissionGrant;
use App\Models\User;
use App\Modules\AccessControl\Support\AccessDecision;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * Central Policy Decision Point (PRD §23.2).
 *
 * Decision order (deny wins):
 * 1. Account inactive / suspended
 * 2. Explicit denial (active, unexpired)
 * 3. Mandatory SoD
 * 4. ICT / auditor business-approval blocks
 * 5. Direct grant / Spatie permission (incl. legacy aliases) / role template
 * 6. Scope check against resource context
 */
class PolicyDecisionPoint
{
    public function __construct(
        private readonly PermissionRegistry $registry,
        private readonly SegregationOfDutiesService $sod,
        private readonly AccessScopeResolver $scopes,
        private readonly AccessCacheInvalidator $cache,
    ) {}

    public function authorize(
        User $actor,
        string $permission,
        mixed $resource = null,
        array $context = [],
    ): AccessDecision {
        if (! $this->accountIsActive($actor)) {
            $this->recordUsage($actor, $permission, 'deny', 'account_inactive', $resource, null, $context);

            return AccessDecision::deny('account_inactive', 'Account is not active.');
        }

        $now = $context['at'] ?? now();

        if ($denial = $this->activeDenial($actor, $permission, $now)) {
            $this->auditDenial($actor, $permission, 'explicit_denial', $resource);

            return AccessDecision::deny('explicit_denial', $denial->reason ?: 'Permission explicitly denied.', [
                'denial_id' => $denial->id,
            ]);
        }

        $sod = $this->sod->evaluate($actor, $permission, $resource, $context);
        if (! $sod->allowed) {
            $this->auditDenial($actor, $permission, $sod->reasonCode, $resource);

            return $sod;
        }

        if ($this->isBusinessApproval($permission) && $this->isIctOrTechnicalOnly($actor)) {
            $this->auditDenial($actor, $permission, 'ict_no_business_approve', $resource);

            return AccessDecision::deny(
                'ict_no_business_approve',
                'Technical administrators may not perform business approvals.'
            );
        }

        if ($this->isMutatingBusinessAction($permission) && $this->isAuditorReadOnly($actor)) {
            $this->auditDenial($actor, $permission, 'auditor_read_only', $resource);

            return AccessDecision::deny('auditor_read_only', 'Auditors have read-only access to business records.');
        }

        $equivalents = $this->registry->resolveEquivalents($permission);

        if ($grant = $this->activeDirectGrant($actor, $equivalents, $now)) {
            if (! $this->scopes->allows($actor, $permission, $resource, $context, $grant->scope_type)) {
                $this->recordUsage($actor, $permission, 'deny', 'out_of_scope', $resource, 'direct_grant', $context);

                return AccessDecision::deny('out_of_scope', 'Resource is outside the granted scope.');
            }

            $this->recordUsage($actor, $permission, 'allow', 'direct_grant', $resource, 'direct_grant', $context);

            return AccessDecision::allow('direct_grant', 'Allowed by direct grant.', $permission, 'direct_grant', [
                'grant_id' => $grant->id,
            ]);
        }

        if ($this->actorHasAnyPermission($actor, $equivalents)) {
            if (! $this->scopes->allows($actor, $permission, $resource, $context)) {
                $this->recordUsage($actor, $permission, 'deny', 'out_of_scope', $resource, 'spatie', $context);

                return AccessDecision::deny('out_of_scope', 'Resource is outside the authorised scope.');
            }

            $this->recordUsage($actor, $permission, 'allow', 'role_or_permission', $resource, 'spatie', $context);

            return AccessDecision::allow('role_or_permission', 'Allowed by role or permission.', $permission, 'spatie');
        }

        $this->auditDenial($actor, $permission, 'missing_permission', $resource);

        return AccessDecision::deny('missing_permission', 'Permission not granted.');
    }

    public function assert(
        User $actor,
        string $permission,
        mixed $resource = null,
        array $context = [],
        int $status = 403,
    ): void {
        $decision = $this->authorize($actor, $permission, $resource, $context);
        if ($decision->allowed) {
            return;
        }

        abort($status, $decision->reasonMessage);
    }

    /**
     * @return list<string>
     */
    public function effectivePermissions(User $actor): array
    {
        return $this->cache->rememberEffective($actor, function () use ($actor) {
            $keys = [];
            foreach ($actor->getAllPermissions()->pluck('name') as $name) {
                // Expose both sides of the legacy/canonical alias during the
                // migration. Backend checks and older clients then resolve to
                // the same capability without creating a second policy model.
                foreach ($this->registry->resolveEquivalents((string) $name) as $equivalent) {
                    $keys[] = $equivalent;
                }
            }

            $now = now();
            foreach (UserPermissionGrant::query()
                ->where('user_id', $actor->id)
                ->where('status', 'active')
                ->where(function ($q) use ($now) {
                    $q->whereNull('valid_from')->orWhere('valid_from', '<=', $now);
                })
                ->where(function ($q) use ($now) {
                    $q->whereNull('valid_until')->orWhere('valid_until', '>', $now);
                })
                ->pluck('permission_key') as $key) {
                $keys[] = $key;
            }

            $denied = UserPermissionDenial::query()
                ->where('user_id', $actor->id)
                ->where('status', 'active')
                ->where(function ($q) use ($now) {
                    $q->whereNull('valid_until')->orWhere('valid_until', '>', $now);
                })
                ->pluck('permission_key')
                ->all();

            return array_values(array_diff(array_unique($keys), $denied));
        });
    }

    public function can(User $actor, string $permission, mixed $resource = null, array $context = []): bool
    {
        return $this->authorize($actor, $permission, $resource, $context)->allowed;
    }

    private function accountIsActive(User $actor): bool
    {
        if (property_exists($actor, 'is_active') || isset($actor->is_active)) {
            if ($actor->is_active === false) {
                return false;
            }
        }

        $status = (string) ($actor->account_status ?? User::STATUS_ACTIVE);

        return in_array($status, [User::STATUS_ACTIVE, User::STATUS_PENDING_ACTIVATION, ''], true)
            || $status === User::STATUS_ACTIVE;
    }

    private function activeDenial(User $actor, string $permission, CarbonInterface|string $now): ?UserPermissionDenial
    {
        $equivalents = $this->registry->resolveEquivalents($permission);

        return UserPermissionDenial::query()
            ->where('user_id', $actor->id)
            ->where('status', 'active')
            ->whereIn('permission_key', $equivalents)
            ->where(function ($q) use ($now) {
                $q->whereNull('valid_from')->orWhere('valid_from', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('valid_until')->orWhere('valid_until', '>', $now);
            })
            ->first();
    }

    private function activeDirectGrant(User $actor, array $equivalents, CarbonInterface|string $now): ?UserPermissionGrant
    {
        return UserPermissionGrant::query()
            ->where('user_id', $actor->id)
            ->where('status', 'active')
            ->whereIn('permission_key', $equivalents)
            ->where(function ($q) use ($now) {
                $q->whereNull('valid_from')->orWhere('valid_from', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('valid_until')->orWhere('valid_until', '>', $now);
            })
            ->first();
    }

    private function actorHasAnyPermission(User $actor, array $equivalents): bool
    {
        foreach ($equivalents as $key) {
            // Spatie store only — do not call can() (Gate/policies, not the role catalogue).
            if ($actor->checkPermissionTo($key)) {
                return true;
            }
        }

        return false;
    }

    private function isBusinessApproval(string $permission): bool
    {
        foreach (config('access_control.business_approval_prefixes', []) as $prefix) {
            if (str_starts_with($permission, $prefix)) {
                return true;
            }
        }

        return in_array($permission, [
            'leave.approve',
            'travel.approve',
            'procurement.approve',
            'salary_advance.approve',
            'pif.approve',
        ], true);
    }

    private function isMutatingBusinessAction(string $permission): bool
    {
        foreach (['.create', '.edit', '.approve', '.reject', '.delete', '.manage', '.update', '.certify', '.authorise'] as $needle) {
            if (str_contains($permission, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function isIctOrTechnicalOnly(User $actor): bool
    {
        $ict = config('access_control.ict_platform_admin_roles', []);
        if (! $actor->hasAnyRole($ict)) {
            return false;
        }

        // Pure ICT: has ICT role and lacks Security Access Admin / business roles that legitimately approve.
        $businessRoles = [
            'Secretary General', 'Finance Controller', 'Director', 'HR Manager',
            'Procurement Officer', 'HOD', 'staff',
        ];

        return ! $actor->hasAnyRole($businessRoles);
    }

    private function isAuditorReadOnly(User $actor): bool
    {
        $auditors = config('access_control.auditor_roles', []);
        if (! $actor->hasAnyRole($auditors)) {
            return false;
        }

        return ! $actor->hasAnyRole([
            'Secretary General', 'Finance Controller', 'HR Manager', 'Procurement Officer', 'Director',
        ]);
    }

    private function auditDenial(User $actor, string $permission, string $reason, mixed $resource): void
    {
        $this->recordUsage($actor, $permission, 'deny', $reason, $resource);

        try {
            \App\Models\AuditLog::record('access.permission_denied', [
                'auditable_type' => $resource instanceof Model ? $resource::class : null,
                'auditable_id' => $resource instanceof Model ? $resource->getKey() : null,
                'new_values' => [
                    'actor_id' => $actor->id,
                    'permission' => $permission,
                    'reason' => $reason,
                ],
                'tags' => 'rbac,access-control',
            ]);
        } catch (\Throwable) {
            // Audit must never block the deny path.
        }
    }

    private function recordUsage(
        User $actor,
        string $permission,
        string $decision,
        string $reason,
        mixed $resource,
        ?string $source = null,
        array $context = [],
    ): void {
        try {
            PermissionUsageEvent::create([
                'tenant_id' => $actor->tenant_id,
                'actor_id' => $actor->id,
                'permission_key' => $permission,
                'decision' => $decision,
                'reason_code' => $reason,
                'source' => $source,
                'auditable_type' => $resource instanceof Model ? $resource::class : null,
                'auditable_id' => $resource instanceof Model ? $resource->getKey() : null,
                'context' => $this->safeContext($context),
                'correlation_id' => request()?->attributes->get('request_id'),
                'occurred_at' => now(),
            ]);
        } catch (\Throwable) {
            // Permission logging must never change the access decision.
        }
    }

    private function safeContext(array $context): array
    {
        $safe = [];

        foreach ($context as $key => $value) {
            $key = (string) $key;
            if (preg_match('/password|secret|token|signature|credential/i', $key)) {
                continue;
            }

            if (is_scalar($value) || $value === null) {
                $safe[$key] = $value;

                continue;
            }

            if (is_array($value)) {
                $safe[$key] = json_decode(json_encode($value), true);
            }
        }

        return $safe;
    }
}
