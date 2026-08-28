<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AccountAccessRequest;
use App\Models\AccountInvitation;
use App\Models\Department;
use App\Models\User;
use App\Modules\UserManagement\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UsersController extends Controller
{
    public function __construct(private readonly UserService $userService)
    {
        //
    }

    /**
     * @OA\Get(
     *     path="/api/v1/admin/users",
     *     summary="List users in the authenticated tenant",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="search", in="query", schema={"type":"string"}),
     *     @OA\Parameter(name="department_id", in="query", schema={"type":"integer"}),
     *     @OA\Parameter(name="status", in="query", schema={"type":"string","enum":{"active","inactive"}}),
     *     @OA\Parameter(name="role", in="query", schema={"type":"string"}),
     *     @OA\Parameter(name="per_page", in="query", schema={"type":"integer","default":25}),
     *     @OA\Response(response=200, description="Paginated user list")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);
        $filters = $request->only(['search', 'department_id', 'status', 'role', 'per_page']);
        $users = $this->userService->list($filters);

        return response()->json($users);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/admin/users/{id}",
     *     summary="Get a specific user",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="User detail")
     * )
     */
    public function show(User $user): JsonResponse
    {
        $this->authorize('view', $user);
        return response()->json(
            $user->load(['tenant', 'department', 'roles', 'permissions'])
        );
    }

    /**
     * @OA\Post(
     *     path="/api/v1/admin/users",
     *     summary="Create a new user",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=201, description="User created")
     * )
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', User::class);
        $data = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'email'           => ['required', 'email', 'unique:users,email'],
            'employee_number' => ['nullable', 'string', 'max:50', 'unique:users,employee_number'],
            'job_title'       => ['nullable', 'string', 'max:255'],
            'department_id'   => ['nullable', 'exists:departments,id'],
            'role'            => ['nullable', 'string', 'exists:roles,name'],
            'classification'  => ['nullable', Rule::in(['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET'])],
            'mfa_enabled'     => ['boolean'],
            'bio'             => ['nullable', 'string'],
            'date_of_birth'   => ['nullable', 'date'],
            'join_date'       => ['nullable', 'date'],
            'phone'           => ['nullable', 'string', 'max:50'],
            'nationality'     => ['nullable', 'string', 'max:100'],
            'gender'          => ['nullable', 'string', 'max:20'],
            'marital_status'  => ['nullable', 'string', 'max:20'],
            'emergency_contact_name'         => ['nullable', 'string', 'max:255'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:100'],
            'emergency_contact_phone'        => ['nullable', 'string', 'max:50'],
            'address_line1'   => ['nullable', 'string', 'max:255'],
            'address_line2'   => ['nullable', 'string', 'max:255'],
            'city'            => ['nullable', 'string', 'max:100'],
            'country'         => ['nullable', 'string', 'max:100'],
            'skills'              => ['nullable', 'array'],
            'qualifications'      => ['nullable', 'array'],
            'portfolio_ids'       => ['nullable', 'array'],
            'portfolio_ids.*'     => ['exists:portfolios,id'],
            'password'            => ['prohibited'],
            'send_welcome_email'  => ['boolean'],
        ]);

        $user = $this->userService->create($data, $request->user());

        return response()->json([
            'message' => 'User invited successfully.',
            'user'    => $user,
        ], 201);
    }

    /**
     * @OA\Put(
     *     path="/api/v1/admin/users/{id}",
     *     summary="Update a user",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="User updated")
     * )
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);
        $data = $request->validate([
            'name'           => ['sometimes', 'string', 'max:255'],
            'email'          => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'job_title'      => ['nullable', 'string', 'max:255'],
            'department_id'  => ['nullable', 'exists:departments,id'],
            'role'           => ['nullable', 'string', 'exists:roles,name'],
            'classification' => ['nullable', Rule::in(['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET'])],
            'mfa_enabled'    => ['boolean'],
            'bio'            => ['nullable', 'string'],
            'date_of_birth'  => ['nullable', 'date'],
            'join_date'      => ['nullable', 'date'],
            'phone'          => ['nullable', 'string', 'max:50'],
            'nationality'     => ['nullable', 'string', 'max:100'],
            'gender'          => ['nullable', 'string', 'max:20'],
            'marital_status'  => ['nullable', 'string', 'max:20'],
            'emergency_contact_name'         => ['nullable', 'string', 'max:255'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:100'],
            'emergency_contact_phone'        => ['nullable', 'string', 'max:50'],
            'address_line1'   => ['nullable', 'string', 'max:255'],
            'address_line2'   => ['nullable', 'string', 'max:255'],
            'city'            => ['nullable', 'string', 'max:100'],
            'country'         => ['nullable', 'string', 'max:100'],
            'skills'          => ['nullable', 'array'],
            'qualifications'  => ['nullable', 'array'],
            'portfolio_ids'   => ['nullable', 'array'],
            'portfolio_ids.*' => ['exists:portfolios,id'],
            'position_id'     => ['nullable', 'exists:positions,id'],
        ]);

        // Defense in depth: role/classification changes require assignRole ability.
        if (array_key_exists('role', $data) || array_key_exists('classification', $data)) {
            $this->authorize('assignRole', $user);
        }

        $user = $this->userService->update($user, $data, $request->user());

        return response()->json([
            'message' => 'User updated successfully.',
            'user'    => $user,
        ]);
    }

    /**
     * @OA\Delete(
     *     path="/api/v1/admin/users/{id}",
     *     summary="Deactivate a user (soft disable)",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="User deactivated")
     * )
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorize('delete', $user);
        $this->userService->deactivate($user, $request->user());

        return response()->json(['message' => 'User deactivated successfully.']);
    }

    public function bulkDeactivate(Request $request): JsonResponse
    {
        // Same gate as create: System Admin only (HR can view but not deactivate).
        $this->authorize('create', User::class);

        $data = $request->validate([
            'ids'   => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        $actor = $request->user();
        $result = $this->userService->bulkDeactivate(
            $data['ids'],
            $actor,
            fn (User $target) => $actor->can('delete', $target),
        );

        return response()->json([
            'message'            => 'Bulk deactivate completed.',
            'deactivated'        => $result['deactivated'],
            'deactivated_count'  => count($result['deactivated']),
            'skipped'            => $result['skipped'],
            'skipped_count'      => count($result['skipped']),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/api/v1/admin/users/{id}/reactivate",
     *     summary="Reactivate a deactivated user",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="User reactivated")
     * )
     */
    public function reactivate(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);
        $user = $this->userService->reactivate($user, $request->user());

        return response()->json(['message' => 'User reactivated.', 'user' => $user]);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $data = $request->validate([
            'status' => ['required', Rule::in([
                User::STATUS_ACTIVE,
                User::STATUS_LOCKED,
                User::STATUS_SUSPENDED,
                User::STATUS_DISABLED,
                User::STATUS_OFFBOARDED,
            ])],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($request->user()->id === $user->id && $data['status'] !== User::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'status' => ['Administrators cannot revoke their own account status.'],
            ]);
        }

        $updated = $this->userService->updateAccountStatus(
            $user,
            $data['status'],
            $request->user(),
            $data['reason'] ?? null
        );

        return response()->json(['message' => 'Account status updated.', 'user' => $updated]);
    }

    public function updateRoles(Request $request, User $user): JsonResponse
    {
        $this->authorize('assignRole', $user);

        $data = $request->validate([
            'role' => ['nullable', 'string', 'exists:roles,name'],
            'roles' => ['nullable', 'array', 'min:1'],
            'roles.*' => ['string', 'exists:roles,name'],
        ]);

        $roles = $data['roles'] ?? array_filter([$data['role'] ?? null]);
        if ($roles === []) {
            throw ValidationException::withMessages([
                'roles' => ['At least one role is required.'],
            ]);
        }

        $oldRoles = $user->getRoleNames()->values()->all();
        $privileged = array_values(array_intersect($roles, [
            'System Admin', 'Secretary General', 'Director of Finance and Corporate Services',
            'Finance Controller', 'HR Manager',
        ]));
        if ($privileged !== []) {
            $pending = \App\Models\AccessControl\AccessRoleSyncRequest::query()->create([
                'tenant_id' => $user->tenant_id,
                'user_id' => $user->id,
                'roles' => array_values($roles),
                'requested_by' => $request->user()->id,
                'status' => 'pending_approval',
                'reason' => 'Privileged role assignment requires dual control.',
            ]);
            \App\Models\AuditLog::record('user.roles_pending_dual_control', [
                'auditable_type' => User::class,
                'auditable_id' => $user->id,
                'old_values' => ['roles' => $oldRoles],
                'new_values' => ['roles' => array_values($roles), 'request_id' => $pending->id],
                'tags' => 'auth,dual-control',
            ]);

            return response()->json([
                'message' => 'Privileged role change pending second approval.',
                'data' => ['status' => 'pending_approval', 'request_id' => $pending->id],
            ], 202);
        }

        $user->syncRoles($roles);
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        $this->userService->revokeAllAccess($user);

        \App\Models\AuditLog::record('user.roles_updated', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'old_values' => ['roles' => $oldRoles],
            'new_values' => ['roles' => array_values($roles)],
            'tags' => 'auth',
        ]);

        return response()->json(['message' => 'User roles updated.', 'user' => $user->fresh(['roles'])]);
    }

    public function approveRoleSync(Request $request, \App\Models\AccessControl\AccessRoleSyncRequest $syncRequest): JsonResponse
    {
        $this->authorize('create', User::class);
        abort_unless((int) $syncRequest->tenant_id === (int) $request->user()->tenant_id, 404);
        if ((int) $syncRequest->requested_by === (int) $request->user()->id) {
            abort(403, 'A different administrator must approve privileged role changes.');
        }
        if ($syncRequest->status !== 'pending_approval') {
            abort(422, 'This role-sync request is not pending.');
        }

        $target = User::query()->findOrFail($syncRequest->user_id);
        $this->authorize('assignRole', $target);
        $oldRoles = $target->getRoleNames()->values()->all();
        $roles = (array) $syncRequest->roles;
        $target->syncRoles($roles);
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        $this->userService->revokeAllAccess($target);

        $syncRequest->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
        ]);

        \App\Models\AuditLog::record('user.roles_updated', [
            'auditable_type' => User::class,
            'auditable_id' => $target->id,
            'old_values' => ['roles' => $oldRoles],
            'new_values' => ['roles' => array_values($roles), 'dual_control_request_id' => $syncRequest->id],
            'tags' => 'auth,dual-control',
        ]);

        return response()->json([
            'message' => 'Privileged roles applied after dual control.',
            'user' => $target->fresh(['roles']),
        ]);
    }

    public function resendInvitation(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        if ($user->accountAllowsAuthentication()) {
            throw ValidationException::withMessages([
                'user' => ['Active accounts do not use invitation links.'],
            ]);
        }

        $invitation = $this->userService->issueInvitation($user, $request->user(), true);

        \App\Models\AuditLog::record('user.invitation_resent', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'new_values' => ['invitation_id' => $invitation->id],
            'tags' => 'auth',
        ]);

        return response()->json(['message' => 'Invitation resent.', 'user' => $user->fresh(['latestAccountInvitation'])]);
    }

    public function mfaReset(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        if ($request->user()->id === $user->id) {
            throw ValidationException::withMessages([
                'user' => ['Use the self-service MFA flow for your own account.'],
            ]);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $user->forceFill([
            'mfa_enabled' => false,
            'mfa_secret' => null,
        ])->save();
        $this->userService->revokeAllAccess($user);

        \App\Models\AuditLog::record('user.mfa_reset_by_admin', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'new_values' => ['reason' => $data['reason']],
            'tags' => 'auth',
        ]);

        app(\App\Services\NotificationService::class)->dispatch($user, 'user.mfa_reset', [
            'name' => $user->name,
        ], ['module' => 'auth'], true, false);

        return response()->json(['message' => 'MFA reset. User sessions were revoked.']);
    }

    public function revokeSessions(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $this->userService->revokeAllAccess($user);

        \App\Models\AuditLog::record('user.sessions_revoked_by_admin', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        app(\App\Services\NotificationService::class)->dispatch($user, 'user.sessions_revoked', [
            'name' => $user->name,
        ], ['module' => 'auth'], true, false);

        return response()->json(['message' => 'User sessions revoked.']);
    }

    /**
     * @OA\Post(
     *     path="/api/v1/admin/users/{id}/change-password",
     *     summary="Admin: send a password reset link for a user",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Password reset link sent")
     * )
     */
    public function changePassword(Request $request, User $user): JsonResponse
    {
        return $this->sendPasswordReset($request, $user);
    }

    public function sendPasswordReset(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $request->validate([
            'password' => ['prohibited'],
            'password_confirmation' => ['prohibited'],
        ]);

        if (! $user->accountAllowsAuthentication()) {
            throw ValidationException::withMessages([
                'user' => ['Password reset links can only be sent to active accounts.'],
            ]);
        }

        $this->userService->revokeAllAccess($user);
        $user->forceFill(['must_reset_password' => true])->save();
        Password::sendResetLink(['email' => $user->email]);

        \App\Models\AuditLog::record('user.password_reset_link_sent_by_admin', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'actor_id'       => $request->user()->id,
            'new_values'     => ['action' => 'reset_link_sent', 'target_user' => $user->email],
            'tags'           => 'auth',
        ]);

        return response()->json(['message' => 'Password reset link sent.']);
    }

    /**
     * @OA\Get(
     *     path="/api/v1/admin/users/{id}/audit",
     *     summary="Get audit trail for a user",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Audit events")
     * )
     */
    public function audit(Request $request, User $user): JsonResponse
    {
        $this->authorize('view', $user);
        $trail = $this->userService->auditTrail($user);

        return response()->json(['data' => $trail]);
    }

    public function accessRequests(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $status = $request->query('status');
        $query = AccountAccessRequest::query()
            ->orderByDesc('created_at');

        if (is_string($status) && $status !== '') {
            $query->where('status', $status);
        }

        return response()->json($query->paginate((int) $request->query('per_page', 25)));
    }

    public function approveAccessRequest(Request $request, AccountAccessRequest $accessRequest): JsonResponse
    {
        $this->authorize('create', User::class);

        if ($accessRequest->status !== AccountAccessRequest::STATUS_REQUESTED) {
            throw ValidationException::withMessages([
                'request' => ['This access request has already been reviewed.'],
            ]);
        }

        if (User::withTrashed()->where('email', $accessRequest->official_email)->exists()) {
            throw ValidationException::withMessages([
                'official_email' => ['A Nexus identity already exists for this email address.'],
            ]);
        }

        $data = $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'employee_number' => ['nullable', 'string', 'max:50', 'unique:users,employee_number'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'classification' => ['nullable', Rule::in(['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET'])],
            'review_comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $this->userService->create([
            'name' => $accessRequest->full_name,
            'email' => $accessRequest->official_email,
            'department_id' => $data['department_id'] ?? null,
            'employee_number' => $data['employee_number'] ?? null,
            'job_title' => $data['job_title'] ?? $accessRequest->position_title,
            'classification' => $data['classification'] ?? 'UNCLASSIFIED',
            'role' => $data['role'],
            'send_welcome_email' => true,
        ], $request->user());

        $accessRequest->forceFill([
            'tenant_id' => $request->user()->tenant_id,
            'status' => AccountAccessRequest::STATUS_APPROVED,
            'reviewed_by_id' => $request->user()->id,
            'reviewed_at' => now(),
            'review_comment' => $data['review_comment'] ?? null,
        ])->save();

        \App\Models\AuditLog::record('auth.access_approved', [
            'auditable_type' => AccountAccessRequest::class,
            'auditable_id' => $accessRequest->id,
            'new_values' => ['user_id' => $user->id],
            'tags' => 'auth',
        ]);

        return response()->json(['message' => 'Access request approved and invitation sent.', 'user' => $user]);
    }

    public function rejectAccessRequest(Request $request, AccountAccessRequest $accessRequest): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        if ($accessRequest->status !== AccountAccessRequest::STATUS_REQUESTED) {
            throw ValidationException::withMessages([
                'request' => ['This access request has already been reviewed.'],
            ]);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $accessRequest->forceFill([
            'tenant_id' => $request->user()->tenant_id,
            'status' => AccountAccessRequest::STATUS_REJECTED,
            'reviewed_by_id' => $request->user()->id,
            'reviewed_at' => now(),
            'review_comment' => $data['reason'],
        ])->save();

        \App\Models\AuditLog::record('auth.access_rejected', [
            'auditable_type' => AccountAccessRequest::class,
            'auditable_id' => $accessRequest->id,
            'new_values' => ['reason' => $data['reason']],
            'tags' => 'auth',
        ]);

        return response()->json(['message' => 'Access request rejected.']);
    }
}
