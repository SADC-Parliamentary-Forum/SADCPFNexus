<?php

namespace App\Http\Controllers\Api\V1\Shared;

use App\Http\Controllers\Controller;
use App\Modules\Shared\Services\WorkingDaysCalculatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function __construct(private readonly WorkingDaysCalculatorService $calculator) {}

    /**
     * Working-day/public-holiday calculation for any module's date-range picker
     * (NexusDateRangePicker). Mirrors LeaveController::preview's shape/scoping.
     */
    public function workingDays(Request $request): JsonResponse
    {
        $data = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'day_part' => ['nullable', 'string', 'in:full,morning,afternoon'],
            'country_code' => ['nullable', 'string', 'max:8'],
        ]);

        $result = $this->calculator->calculate(
            $request->user(),
            $data['start_date'],
            $data['end_date'],
            $data['day_part'] ?? 'full',
            $data['country_code'] ?? null,
        );

        return response()->json(['data' => $result]);
    }
}
