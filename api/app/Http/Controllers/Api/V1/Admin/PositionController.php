<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Position;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PositionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $query = Position::with('department')
            ->where('tenant_id', $tenantId)
            ->orderBy('department_id')
            ->orderBy('grade')
            ->orderBy('title');

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }
        if ($request->filled('active')) {
            $query->where('is_active', $request->boolean('active'));
        }
        if ($request->filled('search')) {
            $query->where('title', 'ilike', '%' . $request->search . '%');
        }

        $positions = $request->boolean('all')
            ? $query->get()
            : $query->paginate($request->integer('per_page', 25));

        return response()->json(['data' => $positions]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'department_id' => 'required|integer|exists:departments,id',
            'title'         => 'required|string|max:150',
            'grade'         => 'nullable|string|max:10',
            'description'   => 'nullable|string|max:1000',
            'headcount'     => 'nullable|integer|min:1|max:999',
            'is_active'     => 'nullable|boolean',
        ]);

        $position = Position::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'headcount' => $data['headcount'] ?? 1,
            'is_active' => $data['is_active'] ?? true,
        ]));

        return response()->json(['data' => $position->load('department'), 'message' => 'Position created.'], 201);
    }

    public function show(Request $request, Position $position): JsonResponse
    {
        $this->authorizeTenant($request, $position);
        return response()->json(['data' => $position->load(['department', 'users'])]);
    }

    public function update(Request $request, Position $position): JsonResponse
    {
        $this->authorizeTenant($request, $position);
        $data = $request->validate([
            'department_id' => 'sometimes|integer|exists:departments,id',
            'title'         => 'sometimes|string|max:150',
            'grade'         => 'nullable|string|max:10',
            'description'   => 'nullable|string|max:1000',
            'headcount'     => 'nullable|integer|min:1|max:999',
            'is_active'     => 'nullable|boolean',
        ]);
        $position->update($data);
        return response()->json(['data' => $position->load('department'), 'message' => 'Position updated.']);
    }

    public function destroy(Request $request, Position $position): JsonResponse
    {
        $this->authorizeTenant($request, $position);
        if ($position->users()->count() > 0) {
            return response()->json(['message' => 'Cannot delete a position with assigned users.'], 422);
        }
        $position->delete();
        return response()->json(['message' => 'Position deleted.']);
    }

    public function assign(Request $request, Position $position): JsonResponse
    {
        $this->authorizeTenant($request, $position);
        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);
        $user = \App\Models\User::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($data['user_id']);
        $user->update(['position_id' => $position->id]);
        return response()->json(['message' => 'Position assigned to user.']);
    }

    private function authorizeTenant(Request $request, Position $position): void
    {
        if ($position->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }
    }
}
