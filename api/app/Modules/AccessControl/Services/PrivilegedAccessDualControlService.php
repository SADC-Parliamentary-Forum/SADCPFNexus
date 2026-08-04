<?php

namespace App\Modules\AccessControl\Services;

use App\Models\AccessControl\AccessRoleAssignment;
use App\Models\AccessControl\AccessRoleVersion;
use App\Models\AccessControl\UserPermissionGrant;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Admin ↔ People & Authority dual-control for privileged grants.
 * Access Admin cannot self-approve privileged access; a distinct second approver is required.
 */
class PrivilegedAccessDualControlService
{
    /**
     * Permissions / role risk levels that require second approval.
     *
     * @var list<string>
     */
    public const PRIVILEGED_PERMISSION_PREFIXES = [
        'admin.',
        'roles.',
        'system.',
        'audit-trail.admin',
        'audit-trail.manage-',
        'finance.admin',
        'hr.admin',
        'procurement.admin',
        'access.',
    ];

    public function isPrivilegedPermission(string $permissionKey): bool
    {
        foreach (self::PRIVILEGED_PERMISSION_PREFIXES as $prefix) {
            if (str_starts_with($permissionKey, $prefix) || $permissionKey === rtrim($prefix, '.')) {
                return true;
            }
        }

        return in_array($permissionKey, [
            'roles.manage', 'roles.assign', 'roles.approve',
            'admin.roles.manage', 'admin.roles.assign', 'admin.roles.approve',
            'users.manage', 'users.impersonate',
        ], true);
    }

    public function isPrivilegedRoleVersion(AccessRoleVersion $version): bool
    {
        $level = (string) ($version->catalogue?->risk_level ?? 'medium');

        return in_array($level, ['high', 'critical'], true);
    }

    /**
     * Create a privileged grant in pending_approval (or active when already dual-controlled).
     */
    public function createGrant(User $target, array $data, User $actor): UserPermissionGrant
    {
        $permissionKey = $data['permission_key'];
        $privileged = $this->isPrivilegedPermission($permissionKey);
        $scopeType = $data['scope_type'] ?? 'self';
        $scopeReference = $data['scope_reference'] ?? null;
        $validFrom = Carbon::parse($data['valid_from'] ?? now());
        $validUntil = isset($data['valid_until']) && $data['valid_until'] !== null
            ? Carbon::parse($data['valid_until'])
            : null;

        if ($privileged && (int) $target->id === (int) $actor->id) {
            throw ValidationException::withMessages([
                'permission_key' => ['Access administrators cannot grant themselves privileged access.'],
            ]);
        }

        if ($validUntil !== null && $validUntil->lt($validFrom)) {
            throw ValidationException::withMessages([
                'valid_until' => ['The grant expiry must be on or after the start date.'],
            ]);
        }

        $duplicate = UserPermissionGrant::query()
            ->where('tenant_id', $target->tenant_id)
            ->where('user_id', $target->id)
            ->where('permission_key', $permissionKey)
            ->where('scope_type', $scopeType)
            ->where(function (Builder $query) use ($scopeReference): void {
                if ($scopeReference === null) {
                    $query->whereNull('scope_reference');
                } else {
                    $query->where('scope_reference', $scopeReference);
                }
            })
            ->whereIn('status', ['active', 'pending_approval'])
            ->where(function (Builder $query) use ($validFrom, $validUntil): void {
                $query->where(function (Builder $range) use ($validFrom): void {
                    $range->whereNull('valid_until')
                        ->orWhere('valid_until', '>=', $validFrom);
                });

                if ($validUntil !== null) {
                    $query->where(function (Builder $range) use ($validUntil): void {
                        $range->whereNull('valid_from')
                            ->orWhere('valid_from', '<=', $validUntil);
                    });
                }
            })
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'permission_key' => ['An active or pending grant already covers this user, permission and scope for the requested period.'],
            ]);
        }

        $status = $privileged ? 'pending_approval' : 'active';
        $approvedBy = $privileged ? null : $actor->id;

        $grant = UserPermissionGrant::create([
            'tenant_id' => $target->tenant_id,
            'user_id' => $target->id,
            'permission_key' => $permissionKey,
            'scope_type' => $scopeType,
            'scope_reference' => $scopeReference,
            'valid_from' => $validFrom,
            'valid_until' => $validUntil,
            'status' => $status,
            'reason' => $data['reason'],
            'granted_by' => $actor->id,
            'approved_by' => $approvedBy,
        ]);

        AuditLog::record($privileged ? 'access.permission.grant_pending' : 'access.permission.granted', [
            'auditable_type' => User::class,
            'auditable_id' => $target->id,
            'new_values' => [
                'grant_id' => $grant->id,
                'permission_key' => $grant->permission_key,
                'status' => $grant->status,
                'scope_type' => $grant->scope_type,
                'reason' => $grant->reason,
                'dual_control' => $privileged,
            ],
            'tags' => 'rbac,access-control,dual-control',
        ]);

        return $grant;
    }

    public function approveGrant(UserPermissionGrant $grant, User $approver): UserPermissionGrant
    {
        if ($grant->status !== 'pending_approval') {
            throw ValidationException::withMessages(['status' => ['Grant is not awaiting approval.']]);
        }

        if ((int) $grant->granted_by === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approver' => ['Second approver must be different from the grantor (dual-control).'],
            ]);
        }

        if ((int) $grant->user_id === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approver' => ['You cannot approve a privileged grant benefiting yourself.'],
            ]);
        }

        $grant->update([
            'status' => 'active',
            'approved_by' => $approver->id,
        ]);

        app(AccessCacheInvalidator::class)->invalidateUserId((int) $grant->user_id, $grant->tenant_id);

        AuditLog::record('access.permission.granted', [
            'auditable_type' => User::class,
            'auditable_id' => $grant->user_id,
            'new_values' => [
                'grant_id' => $grant->id,
                'permission_key' => $grant->permission_key,
                'granted_by' => $grant->granted_by,
                'approved_by' => $approver->id,
                'dual_control' => true,
            ],
            'tags' => 'rbac,access-control,dual-control',
        ]);

        return $grant->fresh();
    }

    public function rejectGrant(UserPermissionGrant $grant, User $actor, ?string $reason = null): UserPermissionGrant
    {
        if ($grant->status !== 'pending_approval') {
            throw ValidationException::withMessages(['status' => ['Grant is not awaiting approval.']]);
        }

        $grant->update([
            'status' => 'rejected',
            'reason' => trim(($grant->reason ?? '').' | rejected: '.($reason ?? 'dual-control rejected')),
            'approved_by' => $actor->id,
        ]);

        AuditLog::record('access.permission.grant_rejected', [
            'auditable_type' => User::class,
            'auditable_id' => $grant->user_id,
            'new_values' => [
                'grant_id' => $grant->id,
                'permission_key' => $grant->permission_key,
                'rejected_by' => $actor->id,
                'reason' => $reason,
            ],
            'tags' => 'rbac,access-control,dual-control',
        ]);

        return $grant->fresh();
    }

    /**
     * Privileged role assignments require pending status until a second approver confirms.
     */
    public function createRoleAssignment(
        User $target,
        AccessRoleVersion $version,
        array $data,
        User $actor
    ): AccessRoleAssignment {
        $privileged = $this->isPrivilegedRoleVersion($version);
        $scopeType = $data['scope_type'] ?? 'organisation';
        $scopeReference = $data['scope_reference'] ?? null;
        $validFrom = Carbon::parse($data['valid_from'] ?? now());
        $validUntil = isset($data['valid_until']) && $data['valid_until'] !== null
            ? Carbon::parse($data['valid_until'])
            : null;

        if ($privileged && (int) $target->id === (int) $actor->id) {
            throw ValidationException::withMessages([
                'role' => ['Access administrators cannot assign themselves privileged roles.'],
            ]);
        }

        if ($validUntil !== null && $validUntil->lt($validFrom)) {
            throw ValidationException::withMessages([
                'valid_until' => ['The role assignment expiry must be on or after the start date.'],
            ]);
        }

        $duplicate = AccessRoleAssignment::query()
            ->where('tenant_id', $target->tenant_id)
            ->where('user_id', $target->id)
            ->where('role_version_id', $version->id)
            ->where('scope_type', $scopeType)
            ->where(function (Builder $query) use ($scopeReference): void {
                if ($scopeReference === null) {
                    $query->whereNull('scope_reference');
                } else {
                    $query->where('scope_reference', $scopeReference);
                }
            })
            ->whereIn('status', ['active', 'pending_approval'])
            ->where(function (Builder $query) use ($validFrom, $validUntil): void {
                $query->where(function (Builder $range) use ($validFrom): void {
                    $range->whereNull('valid_until')
                        ->orWhere('valid_until', '>=', $validFrom);
                });

                if ($validUntil !== null) {
                    $query->where(function (Builder $range) use ($validUntil): void {
                        $range->whereNull('valid_from')
                            ->orWhere('valid_from', '<=', $validUntil);
                    });
                }
            })
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'role' => ['An active or pending assignment already covers this role, user and scope for the requested period.'],
            ]);
        }

        $assignment = AccessRoleAssignment::create([
            'tenant_id' => $target->tenant_id,
            'user_id' => $target->id,
            'role_version_id' => $version->id,
            'assignment_type' => $data['assignment_type'] ?? 'standing',
            'scope_type' => $scopeType,
            'scope_reference' => $scopeReference,
            'valid_from' => $validFrom,
            'valid_until' => $validUntil,
            'status' => $privileged ? 'pending_approval' : ($data['status'] ?? 'active'),
            'reason' => $data['reason'] ?? null,
            'requested_by' => $actor->id,
            'approved_by' => $privileged ? null : ($data['approved_by'] ?? $actor->id),
            'review_due_at' => $data['review_due_at'] ?? now()->addMonths(6),
        ]);

        if (! $privileged) {
            $roleName = $version->catalogue?->name;
            if ($roleName) {
                $target->assignRole($roleName);
            }
            app(AccessCacheInvalidator::class)->invalidate($target);
        }

        AuditLog::record($privileged ? 'access.role_assignment_pending' : 'access.role_assigned', [
            'auditable_type' => User::class,
            'auditable_id' => $target->id,
            'new_values' => [
                'role_version_id' => $version->id,
                'assignment_id' => $assignment->id,
                'status' => $assignment->status,
                'dual_control' => $privileged,
            ],
            'tags' => 'rbac,access-control,dual-control',
        ]);

        return $assignment;
    }

    public function approveRoleAssignment(AccessRoleAssignment $assignment, User $approver): AccessRoleAssignment
    {
        if ($assignment->status !== 'pending_approval') {
            throw ValidationException::withMessages(['status' => ['Assignment is not awaiting approval.']]);
        }

        if ((int) $assignment->requested_by === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approver' => ['Second approver must be different from the requester (dual-control).'],
            ]);
        }

        if ((int) $assignment->user_id === (int) $approver->id) {
            throw ValidationException::withMessages([
                'approver' => ['You cannot approve a privileged role assignment benefiting yourself.'],
            ]);
        }

        $assignment->update([
            'status' => 'active',
            'approved_by' => $approver->id,
        ]);

        $target = User::find($assignment->user_id);
        $roleName = $assignment->roleVersion?->catalogue?->name
            ?? AccessRoleVersion::with('catalogue')->find($assignment->role_version_id)?->catalogue?->name;
        if ($target && $roleName) {
            $target->assignRole($roleName);
            app(AccessCacheInvalidator::class)->invalidate($target);
        }

        AuditLog::record('access.role_assigned', [
            'auditable_type' => User::class,
            'auditable_id' => $assignment->user_id,
            'new_values' => [
                'assignment_id' => $assignment->id,
                'role_version_id' => $assignment->role_version_id,
                'requested_by' => $assignment->requested_by,
                'approved_by' => $approver->id,
                'dual_control' => true,
            ],
            'tags' => 'rbac,access-control,dual-control',
        ]);

        return $assignment->fresh();
    }
}
