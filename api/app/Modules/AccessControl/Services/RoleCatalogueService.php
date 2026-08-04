<?php

namespace App\Modules\AccessControl\Services;

use App\Models\AccessControl\AccessRequest;
use App\Models\AccessControl\AccessReviewCampaign;
use App\Models\AccessControl\AccessReviewItem;
use App\Models\AccessControl\AccessRoleAssignment;
use App\Models\AccessControl\AccessRoleCatalogue;
use App\Models\AccessControl\AccessRoleVersion;
use App\Models\AccessControl\UserPermissionDenial;
use App\Models\AccessControl\UserPermissionGrant;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RoleCatalogueService
{
    public function __construct(
        private readonly PermissionRegistry $registry,
        private readonly AccessCacheInvalidator $cache,
        private readonly SegregationOfDutiesService $sod,
    ) {}

    public function catalogue(User $actor): array
    {
        $query = AccessRoleCatalogue::query()
            ->with(['currentVersion', 'latestVersion'])
            ->orderBy('name');

        if (! $actor->isSystemAdmin()) {
            $query->where(function ($scope) use ($actor) {
                $scope->whereNull('tenant_id')->orWhere('tenant_id', $actor->tenant_id);
            });
        }

        return $query->get()
            ->all();
    }

    public function createDraft(array $data, User $actor): AccessRoleCatalogue
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '' || in_array($name, CanonicalRoleManager::SYSTEM_ROLES, true)) {
            throw ValidationException::withMessages([
                'name' => ['Choose a valid non-system role name.'],
            ]);
        }

        $key = $data['key'] ?? Str::slug($name, '_');
        if (AccessRoleCatalogue::query()->where('tenant_id', $actor->tenant_id)->where('key', $key)->exists()) {
            throw ValidationException::withMessages([
                'name' => ['A role with this key already exists in the tenant.'],
            ]);
        }

        $permissions = $this->validatedPermissionKeys($data['permissions'] ?? []);
        $risk = $data['risk_level'] ?? 'medium';
        if (! in_array($risk, ['low', 'medium', 'high', 'critical'], true)) {
            throw ValidationException::withMessages([
                'risk_level' => ['The role risk level is not registered.'],
            ]);
        }

        return DB::transaction(function () use ($data, $actor) {
            $catalogue = AccessRoleCatalogue::create([
                'tenant_id' => $actor->tenant_id,
                'key' => $data['key'] ?? Str::slug($data['name'], '_'),
                'name' => trim((string) $data['name']),
                'purpose' => $data['purpose'] ?? null,
                'owner_user_id' => $actor->id,
                'risk_level' => $data['risk_level'] ?? 'medium',
                'status' => 'draft',
                'default_scopes' => $data['default_scopes'] ?? ['organisation'],
                'feature_only' => (bool) ($data['feature_only'] ?? false),
                'read_only' => (bool) ($data['read_only'] ?? false),
                'no_business_approve' => (bool) ($data['no_business_approve'] ?? false),
            ]);

            AccessRoleVersion::create([
                'role_catalogue_id' => $catalogue->id,
                'version' => 1,
                'status' => 'draft',
                'permissions' => $this->validatedPermissionKeys($data['permissions'] ?? []),
                'changelog' => $data['changelog'] ?? 'Draft created',
            ]);

            AuditLog::record('access.role_draft_created', [
                'auditable_type' => AccessRoleCatalogue::class,
                'auditable_id' => $catalogue->id,
                'new_values' => ['name' => $catalogue->name],
                'tags' => 'rbac,access-control',
            ]);

            return $catalogue->load('versions');
        });
    }

    public function publishVersion(AccessRoleCatalogue $catalogue, array $permissions, User $actor, ?string $changelog = null): AccessRoleVersion
    {
        if ($catalogue->status === 'retired') {
            throw ValidationException::withMessages([
                'role' => ['A retired role catalogue cannot be published.'],
            ]);
        }

        if ($catalogue->tenant_id !== null && (int) $catalogue->tenant_id !== (int) $actor->tenant_id) {
            throw ValidationException::withMessages([
                'role' => ['This role catalogue is outside the administrator tenant.'],
            ]);
        }

        if ($catalogue->tenant_id === null && ! $actor->isSystemAdmin()) {
            throw ValidationException::withMessages([
                'role' => ['Only a system administrator may publish a platform-wide role catalogue.'],
            ]);
        }

        if ($catalogue->tenant_id !== null && (int) $catalogue->owner_user_id === (int) $actor->id) {
            throw ValidationException::withMessages([
                'approver' => ['The role draft owner cannot publish their own tenant role. An independent approver is required.'],
            ]);
        }

        $permissions = $this->validatedPermissionKeys($permissions);
        $next = ((int) $catalogue->versions()->max('version')) + 1;

        $version = AccessRoleVersion::create([
            'role_catalogue_id' => $catalogue->id,
            'version' => $next,
            'status' => 'active',
            'permissions' => $permissions,
            'changelog' => $changelog ?? "Published v{$next}",
            'published_by' => $actor->id,
            'published_at' => now(),
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);

        $catalogue->update(['status' => 'active']);
        $catalogue->versions()->where('id', '!=', $version->id)->where('status', 'active')->update(['status' => 'retired']);

        AuditLog::record('access.role_version_published', [
            'auditable_type' => AccessRoleVersion::class,
            'auditable_id' => $version->id,
            'new_values' => ['version' => $next, 'permissions' => $permissions],
            'tags' => 'rbac,access-control',
        ]);

        return $version;
    }

    /** @return list<string> */
    private function validatedPermissionKeys(array $permissions): array
    {
        $permissions = array_values(array_unique(array_filter($permissions, 'is_string')));
        $unknown = array_values(array_diff($permissions, array_keys($this->registry->all())));

        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'permissions' => ['The role contains unregistered permission keys: '.implode(', ', $unknown)],
            ]);
        }

        return $permissions;
    }

    public function assignRoleVersion(User $target, AccessRoleVersion $version, array $data, User $actor): AccessRoleAssignment
    {
        $version->loadMissing('catalogue');

        if ($version->status !== 'active' || ! $version->catalogue || $version->catalogue->status !== 'active') {
            throw ValidationException::withMessages([
                'role' => ['Only an active, published role version may be assigned.'],
            ]);
        }

        if (! $actor->isSystemAdmin() && (int) $target->tenant_id !== (int) $actor->tenant_id) {
            throw ValidationException::withMessages([
                'user' => ['The target user must belong to the same tenant as the assigning administrator.'],
            ]);
        }

        $catalogueTenant = $version->catalogue->tenant_id;
        if (! $actor->isSystemAdmin() && $catalogueTenant !== null && (int) $catalogueTenant !== (int) $target->tenant_id) {
            throw ValidationException::withMessages([
                'role' => ['This role is not available in the target user tenant.'],
            ]);
        }

        $scopeType = (string) ($data['scope_type'] ?? 'organisation');
        if (! in_array($scopeType, config('access_control.scopes', []), true)) {
            throw ValidationException::withMessages([
                'scope_type' => ['The selected role scope is not registered.'],
            ]);
        }

        if (! empty($data['valid_from']) && ! empty($data['valid_until'])
            && strtotime((string) $data['valid_until']) < strtotime((string) $data['valid_from'])) {
            throw ValidationException::withMessages([
                'valid_until' => ['The role expiry must be after the role start date.'],
            ]);
        }

        $sod = $this->sod->evaluate($actor, 'admin.roles.assign', null, [
            'target_user_id' => $target->id,
            'is_privileged' => in_array($version->catalogue?->risk_level, ['high', 'critical'], true),
        ]);
        if (! $sod->allowed) {
            abort(403, $sod->reasonMessage);
        }

        return app(PrivilegedAccessDualControlService::class)
            ->createRoleAssignment($target, $version, $data, $actor);
    }

    public function userAccessProfile(User $user, User $actor): array
    {
        $this->assertSameTenant($user, $actor);
        $pdp = app(PolicyDecisionPoint::class);

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'account_status' => $user->account_status,
                'mfa_enabled' => (bool) $user->mfa_enabled,
            ],
            'spatie_roles' => $user->getRoleNames()->values()->all(),
            'effective_permissions' => $pdp->effectivePermissions($user),
            'role_assignments' => AccessRoleAssignment::query()
                ->with('roleVersion.catalogue')
                ->where('user_id', $user->id)
                ->orderByDesc('id')
                ->get(),
            'direct_grants' => UserPermissionGrant::query()->where('user_id', $user->id)->get(),
            'denials' => UserPermissionDenial::query()->where('user_id', $user->id)->where('status', 'active')->get(),
            'upcoming_expiries' => AccessRoleAssignment::query()
                ->where('user_id', $user->id)
                ->whereNotNull('valid_until')
                ->where('valid_until', '>', now())
                ->where('valid_until', '<=', now()->addDays(30))
                ->get(),
        ];
    }

    public function simulate(User $user, User $actor): array
    {
        $this->assertSameTenant($user, $actor);
        $pdp = app(PolicyDecisionPoint::class);
        $nav = app(NavigationManifestService::class);
        $effective = $pdp->effectivePermissions($user);

        AuditLog::record('access.simulation_run', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'new_values' => ['permission_count' => count($effective)],
            'tags' => 'rbac,access-control',
        ]);

        return [
            'user_id' => $user->id,
            'effective_permissions' => $effective,
            'navigation' => $nav->forUser($user),
            'note' => 'Simulation only — no live impersonation session was created.',
        ];
    }

    public function explorePermission(string $permissionKey, User $actor): array
    {
        $roles = [];
        foreach ($this->registry->roleTemplates() as $name => $meta) {
            $perms = $this->registry->rolePermissions($name);
            if (in_array($permissionKey, $perms, true)) {
                $roles[] = $name;
            }
        }

        $meta = $this->registry->get($permissionKey);

        return [
            'permission' => $permissionKey,
            'registry' => $meta,
            'roles_containing' => array_values(array_unique($roles)),
            'direct_grants' => UserPermissionGrant::query()
                ->where('permission_key', $permissionKey)
                ->where('status', 'active')
                ->when(! $actor->isSystemAdmin(), fn ($query) => $query->where('tenant_id', $actor->tenant_id))
                ->get(),
            'denials' => UserPermissionDenial::query()
                ->where('permission_key', $permissionKey)
                ->where('status', 'active')
                ->when(! $actor->isSystemAdmin(), fn ($query) => $query->where('tenant_id', $actor->tenant_id))
                ->get(),
        ];
    }

    private function assertSameTenant(User $target, User $actor): void
    {
        if (! $actor->isSystemAdmin() && (int) $target->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }

    public function createAccessRequest(User $requester, array $data): AccessRequest
    {
        if (empty($data['permission_key']) && empty($data['role_catalogue_key'])) {
            throw ValidationException::withMessages([
                'permission_key' => ['Request a registered permission or a governed role catalogue.'],
            ]);
        }

        if (! empty($data['permission_key']) && ! $this->registry->get((string) $data['permission_key'])) {
            throw ValidationException::withMessages([
                'permission_key' => ['The requested permission is not registered in the canonical access registry.'],
            ]);
        }

        if (! empty($data['role_catalogue_key'])) {
            $roleQuery = AccessRoleCatalogue::query()
                ->where('key', (string) $data['role_catalogue_key'])
                ->where('status', '!=', 'retired');
            if (! $requester->isSystemAdmin()) {
                $roleQuery->where(function ($scope) use ($requester) {
                    $scope->whereNull('tenant_id')->orWhere('tenant_id', $requester->tenant_id);
                });
            }

            if (! $roleQuery->exists()) {
                throw ValidationException::withMessages([
                    'role_catalogue_key' => ['The requested role catalogue is not available in this tenant.'],
                ]);
            }
        }

        $scopeType = (string) ($data['scope_type'] ?? 'self');
        if (! in_array($scopeType, $this->registry->scopes(), true)) {
            throw ValidationException::withMessages([
                'scope_type' => ['The requested access scope is not registered.'],
            ]);
        }

        if (! empty($data['valid_from']) && ! empty($data['valid_until'])
            && strtotime((string) $data['valid_until']) < strtotime((string) $data['valid_from'])) {
            throw ValidationException::withMessages([
                'valid_until' => ['The requested access expiry must be after the start date.'],
            ]);
        }

        $request = AccessRequest::create([
            'tenant_id' => $requester->tenant_id,
            'requester_id' => $requester->id,
            'permission_key' => $data['permission_key'] ?? null,
            'role_catalogue_key' => $data['role_catalogue_key'] ?? null,
            'scope_type' => $scopeType,
            'scope_reference' => $data['scope_reference'] ?? null,
            'business_reason' => $data['business_reason'],
            'sensitivity' => $data['sensitivity'] ?? 'Internal',
            'valid_from' => $data['valid_from'] ?? now(),
            'valid_until' => $data['valid_until'] ?? null,
            'status' => 'pending_supervisor',
            'supervisor_id' => $data['supervisor_id'] ?? null,
            'sod_result' => ['status' => 'pending_check'],
        ]);

        AuditLog::record('access.request_created', [
            'auditable_type' => AccessRequest::class,
            'auditable_id' => $request->id,
            'tags' => 'rbac,access-control',
        ]);

        return $request;
    }

    public function decideAccessRequest(AccessRequest $request, User $actor, string $decision, string $stage = 'supervisor'): AccessRequest
    {
        if (! $actor->isSystemAdmin() && (int) $request->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $expectedStatus = $stage === 'supervisor' ? 'pending_supervisor' : 'pending_approver';
        if ($request->status !== $expectedStatus) {
            throw ValidationException::withMessages([
                'status' => ['This access request is not awaiting the selected approval stage.'],
            ]);
        }

        if ($stage === 'supervisor') {
            $request->update([
                'supervisor_id' => $actor->id,
                'supervisor_decision' => $decision,
                'supervisor_decided_at' => now(),
                'status' => $decision === 'approve' ? 'pending_approver' : 'rejected',
            ]);
        } else {
            $request->update([
                'approver_id' => $actor->id,
                'approver_decision' => $decision,
                'approver_decided_at' => now(),
                'status' => $decision === 'approve' ? 'approved' : 'rejected',
            ]);

            if ($decision === 'approve' && $request->permission_key) {
                if (! $this->registry->get((string) $request->permission_key)) {
                    throw ValidationException::withMessages([
                        'permission_key' => ['The requested permission is no longer registered and cannot be granted.'],
                    ]);
                }

                UserPermissionGrant::create([
                    'tenant_id' => $request->tenant_id,
                    'user_id' => $request->requester_id,
                    'permission_key' => $request->permission_key,
                    'scope_type' => $request->scope_type,
                    'scope_reference' => $request->scope_reference,
                    'valid_from' => $request->valid_from,
                    'valid_until' => $request->valid_until,
                    'status' => 'active',
                    'reason' => $request->business_reason,
                    'granted_by' => $actor->id,
                    'approved_by' => $actor->id,
                ]);
                $this->cache->invalidateUserId((int) $request->requester_id, $request->tenant_id);
            }
        }

        AuditLog::record('access.request_decided', [
            'auditable_type' => AccessRequest::class,
            'auditable_id' => $request->id,
            'new_values' => ['stage' => $stage, 'decision' => $decision],
            'tags' => 'rbac,access-control',
        ]);

        return $request->fresh();
    }

    public function createReviewCampaign(array $data, User $actor): AccessReviewCampaign
    {
        // Uses People & Authority access_review_* tables (shared schema).
        $campaign = AccessReviewCampaign::create([
            'tenant_id' => $actor->tenant_id,
            'name' => $data['name'],
            'campaign_type' => $data['campaign_type'] ?? 'rbac',
            'recurrence' => $data['cadence'] ?? $data['recurrence'] ?? 'quarterly',
            'status' => 'open',
            'due_date' => isset($data['due_at']) ? date('Y-m-d', strtotime((string) $data['due_at'])) : now()->addDays(30)->toDateString(),
            'created_by' => $actor->id,
            'opened_at' => now(),
        ]);

        $userIds = User::query()
            ->where('tenant_id', $actor->tenant_id)
            ->when(isset($data['user_ids']), fn ($query) => $query->whereIn('id', $data['user_ids']))
            ->limit(200)
            ->pluck('id');
        foreach ($userIds as $userId) {
            $user = User::query()->where('tenant_id', $actor->tenant_id)->find($userId);
            if (! $user) {
                continue;
            }
            foreach ($user->getRoleNames() as $roleName) {
                AccessReviewItem::create([
                    'tenant_id' => $actor->tenant_id,
                    'campaign_id' => $campaign->id,
                    'user_id' => $user->id,
                    'review_type' => 'role',
                    'subject_snapshot' => ['role' => $roleName],
                    'status' => 'pending',
                ]);
            }
        }

        return $campaign->load('items');
    }

    public function decideReviewItem(AccessReviewItem $item, User $actor, string $decision, ?string $reason = null): AccessReviewItem
    {
        if (! $actor->isSystemAdmin() && (int) $item->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        if ($item->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['This access review item has already been decided.'],
            ]);
        }

        $mapped = match ($decision) {
            'confirm' => 'confirm',
            'revoke' => 'revoke',
            'reduce', 'extend' => 'modify',
            default => $decision,
        };

        $item->update([
            'status' => 'reviewed',
            'decision' => $mapped,
            'reviewed_by' => $actor->id,
            'reviewed_at' => now(),
            'subject_snapshot' => array_merge($item->subject_snapshot ?? [], [
                'decision_reason' => $reason,
                'ui_decision' => $decision,
            ]),
        ]);

        if ($decision === 'revoke') {
            $user = User::query()->where('tenant_id', $item->tenant_id)->find($item->user_id);
            $roleName = $item->roleNameFromSnapshot();
            if ($user && $roleName) {
                $user->removeRole($roleName);
                $this->cache->invalidate($user);
            }
        }

        AuditLog::record('access.review_item_decided', [
            'auditable_type' => AccessReviewItem::class,
            'auditable_id' => $item->id,
            'new_values' => ['decision' => $decision, 'reason' => $reason],
            'tags' => 'rbac,access-control',
        ]);

        return $item->fresh();
    }
}
