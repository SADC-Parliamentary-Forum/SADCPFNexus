<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesController extends Controller
{
    private const GUARD = 'sanctum';

    private const PROTECTED_ROLES = ['System Admin', 'System Administrator', 'super-admin'];

    /**
     * @OA\Get(path="/api/v1/admin/roles", summary="List all roles with permissions", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        $roles = Role::with('permissions')
            ->where('guard_name', self::GUARD)
            ->orderBy('name')
            ->get();
        $permissions = Permission::where('guard_name', self::GUARD)->orderBy('name')->get();

        return response()->json([
            'roles'       => $roles,
            'permissions' => $permissions,
        ]);
    }

    /**
     * @OA\Get(path="/api/v1/admin/roles/{id}", summary="Get a single role with permissions", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function show(Request $request, Role $role): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        $role->load('permissions');

        return response()->json(['data' => $role]);
    }

    /**
     * @OA\Post(path="/api/v1/admin/roles", summary="Create a new role", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        $data = $request->validate([
            'name'          => ['required', 'string', 'max:100', 'unique:roles,name'],
            'permissions'   => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role = Role::create(['name' => $data['name'], 'guard_name' => self::GUARD]);

        if (!empty($data['permissions'])) {
            $role->syncPermissions($data['permissions']);
        }

        AuditLog::record('role.created', [
            'new_values' => ['name' => $role->name, 'permissions' => $data['permissions'] ?? []],
            'tags'       => 'rbac',
        ]);

        return response()->json(['message' => 'Role created.', 'data' => $role->load('permissions')], 201);
    }

    /**
     * @OA\Put(path="/api/v1/admin/roles/{id}/permissions", summary="Sync role permissions (requires dual-control)", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function syncPermissions(Request $request, Role $role): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        $data = $request->validate([
            'permissions'   => ['required', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $old = $role->permissions->pluck('name')->toArray();
        $role->syncPermissions($data['permissions']);

        AuditLog::record('role.permissions_synced', [
            'auditable_type' => Role::class,
            'auditable_id'   => $role->id,
            'old_values'     => ['permissions' => $old],
            'new_values'     => ['permissions' => $data['permissions']],
            'tags'           => 'rbac',
        ]);

        return response()->json([
            'message' => 'Role permissions updated.',
            'data'    => $role->fresh('permissions'),
        ]);
    }

    /**
     * @OA\Put(path="/api/v1/admin/roles/{id}", summary="Update role name", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function update(Request $request, Role $role): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('roles', 'name')
                    ->where('guard_name', $role->guard_name)
                    ->ignore($role->id),
            ],
        ]);

        $role->update(['name' => $data['name']]);

        AuditLog::record('role.updated', [
            'auditable_type' => Role::class,
            'auditable_id'   => $role->id,
            'new_values'     => ['name' => $role->name],
            'tags'           => 'rbac',
        ]);

        return response()->json(['message' => 'Role updated.', 'data' => $role->fresh('permissions')]);
    }

    /**
     * @OA\Delete(path="/api/v1/admin/roles/{id}", summary="Delete a role", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function destroy(Request $request, Role $role): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            throw ValidationException::withMessages([
                'role' => ['This role cannot be deleted.'],
            ]);
        }

        $role->delete();

        AuditLog::record('role.deleted', [
            'auditable_type' => Role::class,
            'auditable_id'   => $role->id,
            'old_values'     => ['name' => $role->name],
            'tags'           => 'rbac',
        ]);

        return response()->json(['message' => 'Role deleted.']);
    }
}
