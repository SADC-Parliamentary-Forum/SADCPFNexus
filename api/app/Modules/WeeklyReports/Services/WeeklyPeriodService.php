<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\Department;
use App\Models\User;
use App\Models\WeeklyReportingPeriod;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WeeklyPeriodService
{
    public function ensureCurrent(User $user, ?Carbon $around = null): WeeklyReportingPeriod
    {
        $around ??= now();
        $start = $around->copy()->startOfWeek(Carbon::MONDAY)->startOfDay();
        $end = $around->copy()->endOfWeek(Carbon::FRIDAY)->startOfDay();
        // Reporting week Mon–Fri per Admin Rules; end_date is Friday.
        if ($end->gt($start->copy()->addDays(4))) {
            $end = $start->copy()->addDays(4);
        }

        return WeeklyReportingPeriod::firstOrCreate(
            [
                'tenant_id' => $user->tenant_id,
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
            ],
            [
                'reference' => sprintf('WRP-%s-%s', $start->format('Y'), $start->format('W')),
                'employee_due_at' => $end->copy()->setTime(17, 0),
                'supervisor_due_at' => $end->copy()->addDay()->setTime(12, 0),
                'department_due_at' => $end->copy()->addDays(2)->setTime(17, 0),
                'management_due_at' => $end->copy()->addDays(3)->setTime(17, 0),
                'status' => 'open',
                'configuration_snapshot' => [
                    'workweek' => 'mon-fri',
                    'created_via' => 'ensureCurrent',
                ],
            ]
        );
    }

    public function create(User $actor, array $data): WeeklyReportingPeriod
    {
        $start = Carbon::parse($data['start_date'])->startOfDay();
        $end = Carbon::parse($data['end_date'])->startOfDay();

        if ($end->lt($start)) {
            throw ValidationException::withMessages(['end_date' => 'End date must be on or after start date.']);
        }

        return WeeklyReportingPeriod::create([
            'tenant_id' => $actor->tenant_id,
            'reference' => $data['reference'] ?? sprintf('WRP-%s-%s', $start->format('Y'), $start->format('W')),
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'employee_due_at' => $data['employee_due_at'] ?? $end->copy()->setTime(17, 0),
            'supervisor_due_at' => $data['supervisor_due_at'] ?? null,
            'department_due_at' => $data['department_due_at'] ?? null,
            'management_due_at' => $data['management_due_at'] ?? null,
            'status' => $data['status'] ?? 'open',
            'configuration_snapshot' => $data['configuration_snapshot'] ?? null,
        ]);
    }

    public function list(User $user, int $limit = 20)
    {
        return WeeklyReportingPeriod::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('start_date')
            ->limit($limit)
            ->get();
    }

    public function resolveSupervisor(User $employee): ?int
    {
        if (! $employee->department_id) {
            return null;
        }

        return Department::where('id', $employee->department_id)->value('supervisor_id');
    }
}
