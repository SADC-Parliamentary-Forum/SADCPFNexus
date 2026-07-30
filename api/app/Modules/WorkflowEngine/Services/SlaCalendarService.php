<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use App\Models\WorkflowEngine\WorkflowWorkingCalendar;
use Illuminate\Support\Carbon;

/**
 * Working-day SLA calendars, priority variants, pause-on-hold (PRD §122 / §60–62).
 */
class SlaCalendarService
{
    public function resolveCalendar(?int $tenantId, ?string $code): ?WorkflowWorkingCalendar
    {
        if (! $tenantId) {
            return null;
        }
        if ($code) {
            $found = WorkflowWorkingCalendar::where('tenant_id', $tenantId)->where('code', $code)->first();
            if ($found) {
                return $found;
            }
        }

        return WorkflowWorkingCalendar::where('tenant_id', $tenantId)->where('is_default', true)->first();
    }

    public function computeDueAt(
        Carbon $from,
        int $slaHours,
        ?WorkflowWorkingCalendar $calendar = null,
        ?string $priorityVariant = null
    ): Carbon {
        $hours = $this->adjustHoursForPriority($slaHours, $priorityVariant);
        if (! $calendar) {
            return $from->copy()->addHours($hours);
        }

        $workingDays = $calendar->working_days ?: config('workflow_engine.default_working_days', [1, 2, 3, 4, 5]);
        $holidays = collect($calendar->holidays ?? [])->map(fn ($d) => Carbon::parse($d)->toDateString())->all();
        $cursor = $from->copy()->timezone($calendar->timezone ?: config('workflow_engine.default_timezone'));
        $remaining = $hours;

        while ($remaining > 0) {
            $cursor->addHour();
            $dow = (int) $cursor->dayOfWeekIso;
            $date = $cursor->toDateString();
            if (! in_array($dow, $workingDays, true) || in_array($date, $holidays, true)) {
                continue;
            }
            $start = Carbon::parse($date.' '.$calendar->day_start, $cursor->timezone);
            $end = Carbon::parse($date.' '.$calendar->day_end, $cursor->timezone);
            if ($cursor->lt($start) || $cursor->gt($end)) {
                continue;
            }
            $remaining--;
        }

        return $cursor;
    }

    public function adjustHoursForPriority(int $hours, ?string $variant): int
    {
        return match ($variant) {
            'critical' => max(1, (int) ceil($hours * 0.5)),
            'high' => max(1, (int) ceil($hours * 0.75)),
            default => max(1, $hours),
        };
    }

    /**
     * Extend due_at by paused seconds when resuming from hold.
     */
    public function extendDueForPause(?Carbon $dueAt, int $pausedSeconds): ?Carbon
    {
        if (! $dueAt || $pausedSeconds <= 0) {
            return $dueAt;
        }

        return $dueAt->copy()->addSeconds($pausedSeconds);
    }
}
