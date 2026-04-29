<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\HolidayCalendar;
use App\Models\HolidayDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HolidayCalendarController extends Controller
{
    // ─── Calendars ──────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $calendars = HolidayCalendar::where('tenant_id', $request->user()->tenant_id)
            ->withCount('dates')
            ->orderBy('is_default', 'desc')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $calendars]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSystemAdmin(), 403, 'Insufficient privileges.');
        $data = $request->validate([
            'name'         => ['required', 'string', 'max:100'],
            'country_code' => ['nullable', 'string', 'max:3'],
            'is_default'   => ['nullable', 'boolean'],
        ]);

        $user = $request->user();

        // Only one default per tenant
        if (!empty($data['is_default'])) {
            HolidayCalendar::where('tenant_id', $user->tenant_id)
                ->update(['is_default' => false]);
        }

        $calendar = HolidayCalendar::create([
            'tenant_id'    => $user->tenant_id,
            'name'         => $data['name'],
            'country_code' => $data['country_code'] ?? null,
            'is_default'   => $data['is_default'] ?? false,
        ]);

        return response()->json(['message' => 'Calendar created.', 'data' => $calendar], 201);
    }

    public function show(Request $request, HolidayCalendar $holidayCalendar): JsonResponse
    {
        $this->authorizeCalendar($holidayCalendar, $request->user());
        return response()->json(['data' => $holidayCalendar->load('dates')]);
    }

    public function update(Request $request, HolidayCalendar $holidayCalendar): JsonResponse
    {
        $this->authorizeCalendar($holidayCalendar, $request->user());

        $data = $request->validate([
            'name'         => ['sometimes', 'required', 'string', 'max:100'],
            'country_code' => ['nullable', 'string', 'max:3'],
            'is_default'   => ['nullable', 'boolean'],
        ]);

        if (!empty($data['is_default'])) {
            HolidayCalendar::where('tenant_id', $request->user()->tenant_id)
                ->where('id', '!=', $holidayCalendar->id)
                ->update(['is_default' => false]);
        }

        $holidayCalendar->update($data);

        return response()->json(['message' => 'Calendar updated.', 'data' => $holidayCalendar->fresh()]);
    }

    public function destroy(Request $request, HolidayCalendar $holidayCalendar): JsonResponse
    {
        $this->authorizeCalendar($holidayCalendar, $request->user());
        $holidayCalendar->delete();
        return response()->json(['message' => 'Calendar deleted.']);
    }

    // ─── Dates ──────────────────────────────────────────────────────────────

    public function listDates(Request $request, HolidayCalendar $holidayCalendar): JsonResponse
    {
        $this->authorizeCalendar($holidayCalendar, $request->user());

        $dates = $holidayCalendar->dates()
            ->when($request->input('year'), fn ($q, $y) => $q->whereYear('date', $y))
            ->orderBy('date')
            ->get();

        return response()->json(['data' => $dates]);
    }

    public function bulkUpsertDates(Request $request, HolidayCalendar $holidayCalendar): JsonResponse
    {
        $this->authorizeCalendar($holidayCalendar, $request->user());

        $data = $request->validate([
            'dates'                   => ['required', 'array', 'min:1'],
            'dates.*.date'            => ['required', 'date'],
            'dates.*.holiday_name'    => ['required', 'string', 'max:150'],
            'dates.*.is_paid_holiday' => ['nullable', 'boolean'],
        ]);

        $upserted = 0;
        foreach ($data['dates'] as $row) {
            HolidayDate::updateOrCreate(
                ['holiday_calendar_id' => $holidayCalendar->id, 'date' => $row['date']],
                [
                    'holiday_name'    => $row['holiday_name'],
                    'is_paid_holiday' => $row['is_paid_holiday'] ?? true,
                ]
            );
            $upserted++;
        }

        return response()->json([
            'message'  => "{$upserted} date(s) saved.",
            'data'     => $holidayCalendar->dates()->orderBy('date')->get(),
        ]);
    }

    public function destroyDate(Request $request, HolidayCalendar $holidayCalendar, HolidayDate $holidayDate): JsonResponse
    {
        $this->authorizeCalendar($holidayCalendar, $request->user());

        if ($holidayDate->holiday_calendar_id !== $holidayCalendar->id) {
            abort(404);
        }

        $holidayDate->delete();
        return response()->json(['message' => 'Date removed.']);
    }

    // ─── Helper ─────────────────────────────────────────────────────────────

    private function authorizeCalendar(HolidayCalendar $calendar, $user): void
    {
        if ($calendar->tenant_id !== $user->tenant_id) {
            abort(403);
        }
    }
}
