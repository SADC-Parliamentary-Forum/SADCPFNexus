<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use App\Modules\UserManagement\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
            'skills'          => ['nullable', 'array'],
            'qualifications'  => ['nullable', 'array'],
            'portfolio_ids'   => ['nullable', 'array'],
            'portfolio_ids.*' => ['exists:portfolios,id'],
        ]);

        $user = $this->userService->create($data, $request->user());

        return response()->json([
            'message' => 'User created successfully.',
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

    /**
     * @OA\Post(
     *     path="/api/v1/admin/users/{id}/change-password",
     *     summary="Admin: set a new password for a user",
     *     tags={"Admin - Users"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Password changed")
     * )
     */
    public function changePassword(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $data = $request->validate([
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $user->update(['password' => \Illuminate\Support\Facades\Hash::make($data['password'])]);

        \App\Models\AuditLog::record('user.password_changed_by_admin', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'actor_id'       => $request->user()->id,
            'meta'           => ['target_user' => $user->email],
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
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
}
