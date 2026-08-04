<?php

namespace App\Http\Controllers\Api\V1\AccessControl;

use App\Http\Controllers\Controller;
use App\Models\AccessControl\AccessGovernanceDecision;
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
use App\Modules\AccessControl\Services\AccessCacheInvalidator;
use App\Modules\AccessControl\Services\AccessManifestService;
use App\Modules\AccessControl\Services\NavigationManifestService;
use App\Modules\AccessControl\Services\PermissionRegistry;
use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use App\Modules\AccessControl\Services\RoleCatalogueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccessGovernanceController extends Controller
{
    public function __construct(
        private readonly RoleCatalogueService $roles,
        private readonly PermissionRegistry $registry,
        private readonly PolicyDecisionPoint $pdp,
        private readonly NavigationManifestService $nav,
        private readonly AccessManifestService $manifest,
        private readonly AccessCacheInvalidator $cache,
    ) {}

    public function registry(): JsonResponse
    {
        return response()->json([
            'data' => [
                'permissions' => $this->registry->all(),
                'scopes' => $this->registry->scopes(),
                'modules' => $this->registry->modules(),
                'legacy_aliases' => config('access_control.legacy_aliases', []),
                'sod_rules' => config('access_control.sod_rules', []),
            ],
        ]);
    }

    public function roleCatalogue(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.view');

        return response()->json(['data' => $this->roles->catalogue($request->user())]);
    }

    public function createRoleDraft(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.manage');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'purpose' => ['nullable', 'string'],
            'risk_level' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
            'feature_only' => ['nullable', 'boolean'],
            'read_only' => ['nullable', 'boolean'],
            'no_business_approve' => ['nullable', 'boolean'],
            'changelog' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->roles->createDraft($data, $request->user())], 201);
    }

    public function publishRoleVersion(Request $request, AccessRoleCatalogue $catalogue): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.approve');
        $data = $request->validate([
            'permissions' => ['required', 'array'],
            'changelog' => ['nullable', 'string'],
        ]);

        $version = $this->roles->publishVersion($catalogue, $data['permissions'], $request->user(), $data['changelog'] ?? null);

        return response()->json(['data' => $version]);
    }

    public function userProfile(Request $request, User $user): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.view');

        return response()->json(['data' => $this->roles->userAccessProfile($user, $request->user())]);
    }

    public function simulate(Request $request, User $user): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.access.simulate');

        return response()->json(['data' => $this->roles->simulate($user, $request->user())]);
    }

    public function explore(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.access.explore');
        $data = $request->validate(['permission' => ['required', 'string']]);

        return response()->json(['data' => $this->roles->explorePermission($data['permission'], $request->user())]);
    }

    public function navigation(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->nav->forUser($request->user())]);
    }

    public function effective(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->manifest->effective($request->user())]);
    }

    public function coverage(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.access.explore');

        return response()->json(['data' => $this->manifest->coverage()]);
    }

    public function authorizeCheck(Request $request): JsonResponse
    {
        $data = $request->validate([
            'permission' => ['required', 'string'],
            'resource_type' => ['nullable', 'string'],
            'resource_id' => ['nullable'],
            'context' => ['nullable', 'array'],
        ]);

        $decision = $this->pdp->authorize(
            $request->user(),
            $data['permission'],
            null,
            $data['context'] ?? []
        );

        return response()->json(['data' => $decision->toArray()]);
    }

    public function grantPermission(Request $request, User $user): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.assign', null, [
            'target_user_id' => $user->id,
            'is_privileged' => true,
        ]);

        $data = $request->validate([
            'permission_key' => ['required', 'string'],
            'scope_type' => ['nullable', 'string'],
            'scope_reference' => ['nullable', 'string'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'reason' => ['required', 'string'],
        ]);

        $dual = app(\App\Modules\AccessControl\Services\PrivilegedAccessDualControlService::class);
        $grant = $dual->createGrant($user, $data, $request->user());

        if ($grant->status === 'active') {
            $this->cache->invalidate($user);
        }

        return response()->json([
            'data' => $grant,
            'meta' => [
                'dual_control_required' => $grant->status === 'pending_approval',
                'message' => $grant->status === 'pending_approval'
                    ? 'Privileged grant created pending second approver.'
                    : 'Permission granted.',
            ],
        ], 201);
    }

    public function approveGrant(Request $request, UserPermissionGrant $grant): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.approve');
        abort_unless((int) $grant->tenant_id === (int) $request->user()->tenant_id, 404);

        $dual = app(\App\Modules\AccessControl\Services\PrivilegedAccessDualControlService::class);

        return response()->json(['data' => $dual->approveGrant($grant, $request->user())]);
    }

    public function rejectGrant(Request $request, UserPermissionGrant $grant): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.approve');
        abort_unless((int) $grant->tenant_id === (int) $request->user()->tenant_id, 404);
        $data = $request->validate(['reason' => ['nullable', 'string']]);

        $dual = app(\App\Modules\AccessControl\Services\PrivilegedAccessDualControlService::class);

        return response()->json(['data' => $dual->rejectGrant($grant, $request->user(), $data['reason'] ?? null)]);
    }

    public function approveRoleAssignment(Request $request, AccessRoleAssignment $assignment): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.approve');
        abort_unless((int) $assignment->tenant_id === (int) $request->user()->tenant_id, 404);

        $dual = app(\App\Modules\AccessControl\Services\PrivilegedAccessDualControlService::class);

        return response()->json(['data' => $dual->approveRoleAssignment($assignment, $request->user())]);
    }

    public function denyPermission(Request $request, User $user): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.manage');
        $data = $request->validate([
            'permission_key' => ['required', 'string'],
            'reason' => ['required', 'string'],
            'valid_until' => ['nullable', 'date'],
        ]);

        $denial = UserPermissionDenial::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'permission_key' => $data['permission_key'],
            'status' => 'active',
            'reason' => $data['reason'],
            'valid_until' => $data['valid_until'] ?? null,
            'denied_by' => $request->user()->id,
        ]);

        $this->cache->invalidate($user);

        AuditLog::record('access.permission.denied', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'new_values' => [
                'permission_key' => $denial->permission_key,
                'reason' => $denial->reason,
                'valid_until' => $denial->valid_until,
            ],
            'tags' => 'access_control',
        ]);

        return response()->json(['data' => $denial], 201);
    }

    public function accessRequests(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.access.requests.manage');

        return response()->json([
            'data' => AccessRequest::query()->orderByDesc('id')->limit(100)->get(),
        ]);
    }

    public function storeAccessRequest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'permission_key' => ['nullable', 'string'],
            'role_catalogue_key' => ['nullable', 'string'],
            'scope_type' => ['nullable', 'string'],
            'scope_reference' => ['nullable', 'string'],
            'business_reason' => ['required', 'string'],
            'sensitivity' => ['nullable', 'string'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'supervisor_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $this->roles->createAccessRequest($request->user(), $data)], 201);
    }

    public function decideAccessRequest(Request $request, AccessRequest $accessRequest): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'stage' => ['nullable', 'in:supervisor,approver'],
        ]);

        $stage = $data['stage'] ?? 'supervisor';
        if ($stage === 'approver') {
            $this->pdp->assert($request->user(), 'admin.roles.approve');
        }

        return response()->json([
            'data' => $this->roles->decideAccessRequest($accessRequest, $request->user(), $data['decision'], $stage),
        ]);
    }

    public function reviewCampaigns(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.access.reviews.manage');

        return response()->json([
            'data' => AccessReviewCampaign::query()->with('items')->orderByDesc('id')->limit(50)->get(),
        ]);
    }

    public function storeReviewCampaign(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.access.reviews.manage');
        $data = $request->validate([
            'name' => ['required', 'string'],
            'cadence' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
            'user_ids' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->roles->createReviewCampaign($data, $request->user())], 201);
    }

    public function decideReviewItem(Request $request, AccessReviewItem $item): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.access.reviews.manage');
        $data = $request->validate([
            'decision' => ['required', 'in:confirm,revoke,reduce,extend'],
            'reason' => ['nullable', 'string'],
        ]);

        return response()->json([
            'data' => $this->roles->decideReviewItem($item, $request->user(), $data['decision'], $data['reason'] ?? null),
        ]);
    }

    public function governanceChecklist(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.security.manage');

        return response()->json([
            'data' => AccessGovernanceDecision::query()->orderBy('id')->get(),
        ]);
    }

    public function cutoverStatus(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.view');

        $status = app(\App\Modules\AccessControl\Services\AccessCutoverService::class)
            ->status($request->user()->tenant_id);

        return response()->json(['data' => $status]);
    }

    public function cutoverRevokeObsolete(Request $request): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.revoke');
        $data = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer'],
            'execute' => ['nullable', 'boolean'],
        ]);

        $result = app(\App\Modules\AccessControl\Services\AccessCutoverService::class)
            ->revokeObsoleteBroadRoles($data['user_ids'], (bool) ($data['execute'] ?? false));

        return response()->json(['data' => $result]);
    }

    public function assignRoleVersion(Request $request, User $user, AccessRoleVersion $version): JsonResponse
    {
        $this->pdp->assert($request->user(), 'admin.roles.assign', null, [
            'target_user_id' => $user->id,
            'is_privileged' => true,
        ]);

        $data = $request->validate([
            'assignment_type' => ['nullable', 'string'],
            'scope_type' => ['nullable', 'string'],
            'scope_reference' => ['nullable', 'string'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'reason' => ['required', 'string'],
        ]);

        return response()->json([
            'data' => $this->roles->assignRoleVersion($user, $version, $data, $request->user()),
        ], 201);
    }
}
