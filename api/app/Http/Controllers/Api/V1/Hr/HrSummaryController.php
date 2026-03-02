<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\LeaveBalance;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrSummaryController extends Controller
{
    /** Hours this month, overtime MTD, and leave balances for the current user. */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $now = Carbon::now();
        $monthStart = $now->copy()->startOfMonth()->toDateString();
        $monthEnd = $now->copy()->endOfMonth()->toDateString();

        $timesheets = Timesheet::where('user_id', $user->id)
            ->where(function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('week_start', [$monthStart, $monthEnd])
                    ->orWhereBetween('week_end', [$monthStart, $monthEnd])
                    ->orWhere(function ($q2) use ($monthStart, $monthEnd) {
                        $q2->where('week_start', '<=', $monthStart)->where('week_end', '>=', $monthEnd);
                    });
            })
            ->get();

        $hoursThisMonth = 0;
        $overtimeMtd = 0;
        foreach ($timesheets as $ts) {
            $entries = TimesheetEntry::where('timesheet_id', $ts->id)
                ->whereBetween('work_date', [$monthStart, $monthEnd])
                ->get();
            foreach ($entries as $e) {
                $hoursThisMonth += (float) $e->hours;
                $overtimeMtd += (float) ($e->overtime_hours ?? 0);
            }
        }

        $year = (int) $now->format('Y');
        $leaveBalance = LeaveBalance::where('user_id', $user->id)
            ->where('period_year', $year)
            ->first();

        return response()->json([
            'hours_this_month'      => round($hoursThisMonth, 1),
            'overtime_mtd'          => round($overtimeMtd, 1),
            'annual_leave_left'     => $leaveBalance ? (int) $leaveBalance->annual_balance_days : 0,
            'lil_hours_available'   => $leaveBalance ? (float) $leaveBalance->lil_hours_available : 0,
        ]);
    }
}
