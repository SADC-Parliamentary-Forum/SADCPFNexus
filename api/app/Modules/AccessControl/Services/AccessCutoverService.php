<?php

namespace App\Modules\AccessControl\Services;

use App\Models\AccessControl\AccessRoleAssignment;
use App\Models\AccessControl\AccessRoleCatalogue;
use App\Models\AccessControl\AccessRoleVersion;
use App\Models\User;

/**
 * Pilot / cutover helper — reports validated assignments and obsolete broad roles.
 * Does not invent institutional policy; operators must confirm before revoke.
 */
class AccessCutoverService
{
    /**
     * Roles historically treated as overly broad for dual-run cutover review.
     * Revoke only after operator confirmation (dry-run by default).
     */
    public const OBSOLETE_BROAD_CANDIDATES = [
        'super-admin',
    ];

    /**
     * @return array{
     *   checklist: list<array{id: string, title: string, status: string, detail: string}>,
     *   users_without_versioned_assignment: list<array{id: int, name: string, email: string, roles: list<string>}>,
     *   validated_assignments: int,
     *   expired_assignments: int,
     *   obsolete_broad_role_holders: list<array{user_id: int, email: string, role: string}>,
     *   published_role_versions: int,
     *   governance_pending: bool
     * }
     */
    public function status(?int $tenantId = null): array
    {
        $usersQuery = User::query()->with('roles');
        if ($tenantId) {
            $usersQuery->where('tenant_id', $tenantId);
        }

        $users = $usersQuery->get();
        $activeAssignments = AccessRoleAssignment::query()
            ->with('roleVersion.catalogue')
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->where('status', 'active')
            ->get();

        $validated = $activeAssignments->filter(function (AccessRoleAssignment $a) {
            $version = $a->roleVersion;
            if (! $version || $version->status !== 'active') {
                return false;
            }
            if ($a->valid_until && $a->valid_until->isPast()) {
                return false;
            }

            return true;
        });

        $expired = $activeAssignments->filter(function (AccessRoleAssignment $a) {
            return $a->valid_until && $a->valid_until->isPast();
        });

        $assignedUserIds = $validated->pluck('user_id')->unique()->all();
        $withoutVersion = $users
            ->filter(fn (User $u) => ! in_array($u->id, $assignedUserIds, true))
            ->filter(fn (User $u) => $u->roles->isNotEmpty())
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'roles' => $u->getRoleNames()->values()->all(),
            ])
            ->values()
            ->all();

        $obsoleteHolders = [];
        foreach ($users as $user) {
            foreach (self::OBSOLETE_BROAD_CANDIDATES as $roleName) {
                if ($user->hasRole($roleName)) {
                    $obsoleteHolders[] = [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'role' => $roleName,
                    ];
                }
            }
        }

        $publishedVersions = AccessRoleVersion::query()->where('status', 'active')->count();
        $governancePending = \App\Models\AccessControl\AccessGovernanceDecision::query()
            ->where('status', 'pending')
            ->exists();

        $checklist = [
            [
                'id' => 'freeze_legacy_edits',
                'title' => 'Freeze legacy role edits during dual-run',
                'status' => $publishedVersions > 0 ? 'ready' : 'blocked',
                'detail' => $publishedVersions > 0
                    ? "{$publishedVersions} published access_role_versions available."
                    : 'No published role versions — publish catalogue templates first.',
            ],
            [
                'id' => 'migrate_users',
                'title' => 'Migrate users onto published access_role_versions',
                'status' => count($withoutVersion) === 0 ? 'ready' : 'in_progress',
                'detail' => count($withoutVersion) === 0
                    ? 'All role-bearing users have at least one validated versioned assignment.'
                    : count($withoutVersion).' user(s) still on Spatie roles only (see users_without_versioned_assignment).',
            ],
            [
                'id' => 'validate_assignments',
                'title' => 'Validate active versioned assignments',
                'status' => $expired->isEmpty() ? 'ready' : 'attention',
                'detail' => $validated->count().' validated; '.$expired->count().' marked active but expired.',
            ],
            [
                'id' => 'retire_obsolete_broad',
                'title' => 'Retire obsolete broad roles (operator-confirmed)',
                'status' => count($obsoleteHolders) === 0 ? 'ready' : 'attention',
                'detail' => count($obsoleteHolders) === 0
                    ? 'No obsolete broad-role holders detected.'
                    : count($obsoleteHolders).' holder(s) — use dry-run revoke helper; never auto-revoke in production.',
            ],
            [
                'id' => 'session_refresh',
                'title' => 'Force privileged session refresh on role revoke',
                'status' => 'ready',
                'detail' => 'AccessCacheInvalidator kills Sanctum tokens + UserSession rows on invalidate.',
            ],
            [
                'id' => 'governance_signoff',
                'title' => 'Governance checklist (institutional — Pending)',
                'status' => $governancePending ? 'pending' : 'ready',
                'detail' => $governancePending
                    ? 'Governance decisions remain Pending — do not invent MFA/retention policy in code.'
                    : 'No pending governance rows.',
            ],
            [
                'id' => 'pilot_personas',
                'title' => 'Pilot persona matrix sign-off',
                'status' => 'pending',
                'detail' => 'See docs/access-control/pilot-signoff-pack.md and AccessControlPersonaSeeder.',
            ],
        ];

        return [
            'checklist' => $checklist,
            'users_without_versioned_assignment' => $withoutVersion,
            'validated_assignments' => $validated->count(),
            'expired_assignments' => $expired->count(),
            'obsolete_broad_role_holders' => $obsoleteHolders,
            'published_role_versions' => $publishedVersions,
            'governance_pending' => $governancePending,
        ];
    }

    /**
     * Dry-run (default) or execute removal of obsolete broad roles from listed users.
     * Never removes System Admin. Requires explicit execute=true.
     *
     * @param  list<int>  $userIds
     * @return array{dry_run: bool, actions: list<array{user_id: int, role: string, action: string}>}
     */
    public function revokeObsoleteBroadRoles(array $userIds, bool $execute = false): array
    {
        $actions = [];
        $users = User::query()->whereIn('id', $userIds)->get();

        foreach ($users as $user) {
            foreach (self::OBSOLETE_BROAD_CANDIDATES as $roleName) {
                if (! $user->hasRole($roleName)) {
                    continue;
                }
                if ($roleName === 'System Admin' || $user->hasRole('System Admin')) {
                    $actions[] = [
                        'user_id' => $user->id,
                        'role' => $roleName,
                        'action' => 'skipped_system_admin_protected',
                    ];
                    continue;
                }

                if ($execute) {
                    $user->removeRole($roleName);
                    app(AccessCacheInvalidator::class)->invalidate($user);
                    $actions[] = [
                        'user_id' => $user->id,
                        'role' => $roleName,
                        'action' => 'revoked',
                    ];
                } else {
                    $actions[] = [
                        'user_id' => $user->id,
                        'role' => $roleName,
                        'action' => 'would_revoke',
                    ];
                }
            }
        }

        return [
            'dry_run' => ! $execute,
            'actions' => $actions,
        ];
    }

    /**
     * Assign published catalogue version by template/legacy role name when available.
     */
    public function suggestVersionForRole(string $roleName): ?AccessRoleVersion
    {
        $catalogue = AccessRoleCatalogue::query()
            ->where('name', $roleName)
            ->orWhere('key', \Illuminate\Support\Str::slug($roleName, '_'))
            ->first();

        if (! $catalogue) {
            $templates = config('access_control.role_templates', []);
            foreach ($templates as $name => $meta) {
                if (in_array($roleName, $meta['legacy_roles'] ?? [], true)) {
                    $catalogue = AccessRoleCatalogue::query()
                        ->where('name', $name)
                        ->orWhere('key', \Illuminate\Support\Str::slug($name, '_'))
                        ->first();
                    break;
                }
            }
        }

        return $catalogue?->currentVersion;
    }
}
