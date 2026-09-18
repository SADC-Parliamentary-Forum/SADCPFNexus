<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Returns users in the authenticated user's tenant for assignment dropdowns
 * (e.g. PIF responsible officer). Does not require admin permissions.
 */
class TenantUsersController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $query = User::where('tenant_id', $tenantId)->with('department:id,name');

        if ($request->filled('search')) {
            $term = '%'.$request->input('search').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhereHas('department', fn ($d) => $d->where('name', 'like', $term));
            });
        }

        $users = $query->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'job_title', 'department_id'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'job_title' => $u->job_title,
                'department_id' => $u->department_id,
                'department' => $u->department?->name,
            ]);

        return response()->json(['data' => $users]);
    }
}
