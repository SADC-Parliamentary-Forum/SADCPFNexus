<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentsController extends Controller
{
    /**
     * @OA\Get(path="/api/v1/admin/departments", summary="List departments", tags={"Admin - Departments"}, security={{"sanctum":{}}})
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Department::class);

        $departments = Department::withCount('users')
            ->with('parent', 'children', 'supervisor')
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $departments]);
    }

    /**
     * @OA\Post(path="/api/v1/admin/departments", summary="Create department", tags={"Admin - Departments"}, security={{"sanctum":{}}})
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Department::class);

        $data = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'code'      => ['nullable', 'string', 'max:20'],
            'parent_id' => ['nullable', 'exists:departments,id'],
            'supervisor_id' => ['nullable', 'exists:users,id'],
        ]);

        $dept = Department::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('department.created', [
            'auditable_type' => Department::class,
            'auditable_id'   => $dept->id,
            'new_values'     => $data,
            'tags'           => 'user_management',
        ]);

        return response()->json(['message' => 'Department created.', 'data' => $dept], 201);
    }

    /**
     * @OA\Get(path="/api/v1/admin/departments/{id}", summary="Get department", tags={"Admin - Departments"}, security={{"sanctum":{}}})
     */
    public function show(Request $request, Department $department): JsonResponse
    {
        $this->authorize('view', $department);

        return response()->json(['data' => $department->load('parent', 'children', 'supervisor')->loadCount('users')]);
    }

    /**
     * @OA\Put(path="/api/v1/admin/departments/{id}", summary="Update department", tags={"Admin - Departments"}, security={{"sanctum":{}}})
     */
    public function update(Request $request, Department $department): JsonResponse
    {
        $this->authorize('update', $department);

        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:255'],
            'code'      => ['nullable', 'string', 'max:20'],
            'parent_id' => ['nullable', 'exists:departments,id'],
            'supervisor_id' => ['nullable', 'exists:users,id'],
        ]);

        $department->update($data);

        AuditLog::record('department.updated', [
            'auditable_type' => Department::class,
            'auditable_id'   => $department->id,
            'new_values'     => $data,
            'tags'           => 'user_management',
        ]);

        return response()->json(['message' => 'Department updated.', 'data' => $department->fresh()]);
    }

    /**
     * @OA\Delete(path="/api/v1/admin/departments/{id}", summary="Delete department", tags={"Admin - Departments"}, security={{"sanctum":{}}})
     */
    public function destroy(Department $department): JsonResponse
    {
        $this->authorize('delete', $department);

        if ($department->children()->exists()) {
            return response()->json(['message' => 'Cannot delete department with sub-units.'], 422);
        }

        if ($department->users()->exists()) {
            return response()->json(['message' => 'Cannot delete department with assigned staff.'], 422);
        }

        $department->delete();

        AuditLog::record('department.deleted', [
            'auditable_type' => Department::class,
            'auditable_id'   => $department->id,
            'tags'           => 'user_management',
        ]);

        return response()->json(['message' => 'Department deleted.']);
    }
}
