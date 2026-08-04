<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use App\Modules\AccessControl\Services\CanonicalRoleManager;

class RolesController extends Controller
{
    private const GUARD = 'sanctum';

    /**
     * @OA\Get(path="/api/v1/admin/roles", summary="List all roles with permissions", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        $manager = app(CanonicalRoleManager::class);
        $roles = Role::with('permissions')
            ->where('guard_name', self::GUARD)
            ->whereIn('name', array_merge($manager->canonicalRoleNames(), CanonicalRoleManager::SYSTEM_ROLES))
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

        return $this->canonicalMutationRequired();
    }

    /**
     * @OA\Put(path="/api/v1/admin/roles/{id}/permissions", summary="Sync role permissions (requires dual-control)", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function syncPermissions(Request $request, Role $role): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        return $this->canonicalMutationRequired();
    }

    /**
     * @OA\Put(path="/api/v1/admin/roles/{id}", summary="Update role name", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function update(Request $request, Role $role): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        return $this->canonicalMutationRequired();
    }

    /**
     * @OA\Delete(path="/api/v1/admin/roles/{id}", summary="Delete a role", tags={"Admin - Roles"}, security={{"sanctum":{}}})
     */
    public function destroy(Request $request, Role $role): JsonResponse
    {
        if (!$request->user()->isSystemAdmin()) {
            abort(403);
        }

        return $this->canonicalMutationRequired();
    }

    private function canonicalMutationRequired(): JsonResponse
    {
        abort(409, 'Direct role mutation is disabled. Create, review, publish, retire, and assign roles through the governed Access Control catalogue.');
    }
}
