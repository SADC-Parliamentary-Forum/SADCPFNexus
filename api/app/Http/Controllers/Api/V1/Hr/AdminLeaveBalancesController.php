<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminLeaveBalancesController extends Controller
{
    /** List opening leave balances for all active staff for a given year. */
    public function index(Request $request): JsonResponse
    {
        $authUser = $request->user();

        if (!$this->canManageLeaveBalances($authUser)) {
            abort(403, 'Access restricted to HR administrators.');
        }

        $year = (int) ($request->query('year', date('Y')));

        $users = User::where('tenant_id', $authUser->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'job_title']);

        $userIds = $users->pluck('id');

        $balances = LeaveBalance::whereIn('user_id', $userIds)
            ->where('period_year', $year)
            ->get()
            ->keyBy('user_id');

        // One aggregate query: approved annual leave days used per user for this year
        $annualUsed = LeaveRequest::whereIn('requester_id', $userIds)
            ->where('leave_type', 'annual')
            ->whereYear('start_date', $year)
            ->where('status', 'approved')
            ->selectRaw('requester_id, COALESCE(SUM(days_requested), 0)::int AS annual_used')
            ->groupBy('requester_id')
            ->pluck('annual_used', 'requester_id');

        $rows = $users->map(function (User $user) use ($balances, $annualUsed) {
            $bal = $balances->get($user->id);
            $openingDays = $bal ? (int) $bal->annual_balance_days : 0;
            $lilHours    = $bal ? (float) $bal->lil_hours_available : 0.0;
            $used        = (int) ($annualUsed[$user->id] ?? 0);
            $remaining   = max(0, $openingDays - $used);

            return [
                'user_id'              => $user->id,
                'name'                 => $user->name,
                'email'                => $user->email,
                'job_title'            => $user->job_title,
                'annual_balance_days'  => $openingDays,
                'lil_hours_available'  => $lilHours,
                'annual_used'          => $used,
                'annual_remaining'     => $remaining,
                'has_balance_record'   => $bal !== null,
            ];
        });

        return response()->json([
            'data' => $rows,
            'year' => $year,
        ]);
    }

    /** Create or update a single employee's opening leave balance for a year. */
    public function upsert(Request $request): JsonResponse
    {
        $authUser = $request->user();

        if (!$this->canManageLeaveBalances($authUser)) {
            abort(403, 'Access restricted to HR administrators.');
        }

        $data = $request->validate([
            'user_id'             => ['required', 'integer', 'exists:users,id'],
            'period_year'         => ['required', 'integer', 'min:2000', 'max:2099'],
            'annual_balance_days' => ['required', 'integer', 'min:0', 'max:365'],
            'lil_hours_available' => ['nullable', 'numeric', 'min:0', 'max:9999'],
        ]);

        // Tenant scope guard
        $targetUser = User::find($data['user_id']);
        if (!$targetUser || $targetUser->tenant_id !== $authUser->tenant_id) {
            abort(403, 'Cannot modify leave balances for users outside your organisation.');
        }

        $balance = LeaveBalance::updateOrCreate(
            [
                'user_id'     => $data['user_id'],
                'period_year' => $data['period_year'],
            ],
            [
                'annual_balance_days' => $data['annual_balance_days'],
                'lil_hours_available' => $data['lil_hours_available'] ?? 0,
            ]
        );

        AuditLog::record('hr.leave_balance.upserted', [
            'auditable_type' => LeaveBalance::class,
            'auditable_id'   => $balance->id,
            'new_values'     => $data,
            'tags'           => 'hr_leave',
        ]);

        return response()->json([
            'message' => 'Leave balance saved.',
            'data'    => $balance,
        ]);
    }

    private function canManageLeaveBalances($user): bool
    {
        return $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('hr.edit')
            || $user->hasPermissionTo('hr_settings.edit');
    }
}
