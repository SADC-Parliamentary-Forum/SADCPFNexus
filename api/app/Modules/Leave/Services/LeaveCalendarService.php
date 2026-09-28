<?php

namespace App\Modules\Leave\Services;

use App\Models\User;
use App\Modules\Shared\Services\WorkingDaysCalculatorService;

class LeaveCalendarService
{
    public function __construct(private readonly WorkingDaysCalculatorService $calculator = new WorkingDaysCalculatorService) {}

    /** @return array{calendar_days:int,weekend_days:int,public_holidays_excluded:int,working_days:float,holidays:list<array{name:string,date:string}>} */
    public function calculate(User $employee, string $startDate, string $endDate, string $dayPart = 'full', ?string $countryCode = null): array
    {
        return $this->calculator->calculate($employee, $startDate, $endDate, $dayPart, $countryCode);
    }
}
