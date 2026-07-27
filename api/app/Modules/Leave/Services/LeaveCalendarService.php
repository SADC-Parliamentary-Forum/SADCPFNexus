<?php

namespace App\Modules\Leave\Services;

use App\Models\CalendarEntry;
use App\Models\HolidayCalendar;
use App\Models\User;
use Carbon\Carbon;

class LeaveCalendarService
{
    /** @return array{calendar_days:int,weekend_days:int,public_holidays_excluded:int,working_days:float,holidays:list<array{name:string,date:string}>} */
    public function calculate(User $employee, string $startDate, string $endDate, string $dayPart = 'full', ?string $countryCode = null): array
    {
        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();
        $countryCode = $countryCode ?: 'NA';

        $holidays = $this->holidayMap($employee->tenant_id, $start, $end, $countryCode);
        $calendarDays = $start->diffInDays($end) + 1;
        $weekendDays = 0;
        $holidayDays = 0;
        $workingDays = 0.0;
        $holidayRows = [];

        $date = $start->copy();
        while ($date->lte($end)) {
            $key = $date->toDateString();
            if ($date->isWeekend()) {
                $weekendDays++;
            } elseif (isset($holidays[$key])) {
                $holidayDays++;
                $holidayRows[] = ['date' => $key, 'name' => $holidays[$key]];
            } else {
                $workingDays += 1.0;
            }
            $date->addDay();
        }

        if (in_array($dayPart, ['morning', 'afternoon'], true) && $calendarDays === 1 && $workingDays === 1.0) {
            $workingDays = 0.5;
        }

        return [
            'calendar_days' => $calendarDays,
            'weekend_days' => $weekendDays,
            'public_holidays_excluded' => $holidayDays,
            'working_days' => $workingDays,
            'holidays' => $holidayRows,
        ];
    }

    /** @return array<string, string> */
    private function holidayMap(int $tenantId, Carbon $start, Carbon $end, string $countryCode): array
    {
        $fromHolidayTables = HolidayCalendar::query()
            ->with(['dates' => fn ($q) => $q->whereBetween('date', [$start->toDateString(), $end->toDateString()])])
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($countryCode) {
                $q->where('is_default', true)
                    ->orWhere('country_code', $countryCode);
            })
            ->get()
            ->flatMap(fn (HolidayCalendar $calendar) => $calendar->dates)
            ->mapWithKeys(fn ($date) => [$date->date->toDateString() => $date->holiday_name])
            ->all();

        $fromCalendarEntries = CalendarEntry::query()
            ->where('tenant_id', $tenantId)
            ->where('type', CalendarEntry::TYPE_SADC_HOLIDAY)
            ->where(function ($q) use ($countryCode) {
                $q->whereNull('country_code')->orWhere('country_code', $countryCode);
            })
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->pluck('title', 'date')
            ->mapWithKeys(fn ($title, $date) => [Carbon::parse($date)->toDateString() => $title])
            ->all();

        return array_merge($fromCalendarEntries, $fromHolidayTables);
    }
}
