<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesController extends Controller
{
    /**
     * @OA\Get(path="/api/v1/admin/roles", summary="List all roles with permissions", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['System Admin', 'super-admin'])) {
            abort(403);
        }

        $roles = Role::with('permissions')->orderBy('name')->get();
        $permissions = Permission::orderBy('name')->get();

        return response()->json([
            'roles'       => $roles,
            'permissions' => $permissions,
        ]);
    }

    /**
     * @OA\Post(path="/api/v1/admin/roles", summary="Create a new role", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['System Admin', 'super-admin'])) {
            abort(403);
        }

        $data = $request->validate([
            'name'          => ['required', 'string', 'max:100', 'unique:roles,name'],
            'permissions'   => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'sanctum']);

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
        if (!$request->user()->hasAnyRole(['System Admin', 'super-admin'])) {
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
            'message' => 'Role permissions updated. Pending dual-control approval.',
            'data'    => $role->fresh('permissions'),
        ]);
    }
}
