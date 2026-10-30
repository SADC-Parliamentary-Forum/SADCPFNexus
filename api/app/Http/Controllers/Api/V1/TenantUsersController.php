<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Returns users in the authenticated user's tenant for assignment dropdowns
 * (e.g. PIF responsible officer). Does not require admin permissions.
 *
 * Only active users are listed unless `include_invited` is set, which also
 * lists users who have been invited but not yet activated their account
 * (asset custody can be prepared for them before their first sign-in).
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
                $q->where('name', 'ilike', $term)
                    ->orWhere('email', 'ilike', $term)
                    ->orWhereHas('department', fn ($d) => $d->where('name', 'ilike', $term));
            });
        }

        if ($request->boolean('include_invited')) {
            $query->where(function ($q) {
                $q->where('is_active', true)
                    ->orWhere('account_status', User::STATUS_INVITED);
            });
        } else {
            $query->where('is_active', true);
        }

        $users = $query
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'job_title', 'department_id', 'account_status'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'job_title' => $u->job_title,
                'department_id' => $u->department_id,
                'department' => $u->department?->name,
                'account_status' => $u->account_status,
            ]);

        return response()->json(['data' => $users]);
    }
}
