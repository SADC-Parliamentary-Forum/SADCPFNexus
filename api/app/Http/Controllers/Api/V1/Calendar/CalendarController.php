<?php

namespace App\Http\Controllers\Api\V1\Calendar;

use App\Http\Controllers\Controller;
use App\Models\CalendarEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    /**
     * List calendar entries (SADC PF calendar, public holidays, UN days).
     * Filters: type (sadc_holiday | un_day | sadc_calendar), country_code, year, month.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = CalendarEntry::where('tenant_id', $user->tenant_id)
            ->orderBy('date');

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }
        if ($countryCode = $request->input('country_code')) {
            $query->where('country_code', $countryCode);
        }
        if ($year = $request->input('year')) {
            $query->whereYear('date', $year);
        }
        if ($month = $request->input('month')) {
            $query->whereMonth('date', $month);
        }

        $perPage = min((int) $request->input('per_page', 100), 500);
        $entries = $query->paginate($perPage);

        return response()->json($entries);
    }

    /**
     * Store a single calendar entry (public holiday, UN day, or SADC calendar event).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'         => ['required', 'string', 'in:sadc_holiday,un_day,sadc_calendar'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'date'         => ['required', 'date'],
            'title'        => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string', 'max:2000'],
            'is_alert'     => ['boolean'],
        ]);

        $data['tenant_id'] = $request->user()->tenant_id;
        $data['is_alert']  = $data['is_alert'] ?? ($data['type'] === 'un_day');

        $entry = CalendarEntry::create($data);
        return response()->json(['message' => 'Calendar entry created.', 'data' => $entry], 201);
    }

    /**
     * Update a calendar entry.
     */
    public function update(Request $request, CalendarEntry $calendarEntry): JsonResponse
    {
        if ($calendarEntry->tenant_id !== $request->user()->tenant_id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'type'         => ['sometimes', 'string', 'in:sadc_holiday,un_day,sadc_calendar'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'date'         => ['sometimes', 'date'],
            'title'        => ['sometimes', 'string', 'max:255'],
            'description'  => ['nullable', 'string', 'max:2000'],
            'is_alert'     => ['boolean'],
        ]);

        $calendarEntry->update($data);
        return response()->json(['message' => 'Calendar entry updated.', 'data' => $calendarEntry->fresh()]);
    }

    /**
     * Delete a calendar entry.
     */
    public function destroy(Request $request, CalendarEntry $calendarEntry): JsonResponse
    {
        if ($calendarEntry->tenant_id !== $request->user()->tenant_id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }
        $calendarEntry->delete();
        return response()->json(['message' => 'Calendar entry deleted.']);
    }

    /**
     * Bulk upload calendar entries (SADC public holidays, UN days, etc.).
     * Body: { "entries": [ { "type", "country_code?", "date", "title", "description?", "is_alert?" }, ... ] }
     */
    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entries' => ['required', 'array'],
            'entries.*.type'         => ['required', 'string', 'in:sadc_holiday,un_day,sadc_calendar'],
            'entries.*.country_code'  => ['nullable', 'string', 'size:2'],
            'entries.*.date'         => ['required', 'date'],
            'entries.*.title'        => ['required', 'string', 'max:255'],
            'entries.*.description' => ['nullable', 'string', 'max:2000'],
            'entries.*.is_alert'    => ['boolean'],
        ]);

        $tenantId = $request->user()->tenant_id;
        $created = [];

        foreach ($data['entries'] as $row) {
            $entry = CalendarEntry::create([
                'tenant_id'    => $tenantId,
                'type'         => $row['type'],
                'country_code' => $row['country_code'] ?? null,
                'date'         => $row['date'],
                'title'        => $row['title'],
                'description'  => $row['description'] ?? null,
                'is_alert'     => $row['is_alert'] ?? ($row['type'] === 'un_day'),
            ]);
            $created[] = $entry;
        }

        return response()->json([
            'message' => count($created) . ' calendar entries created.',
            'data'    => $created,
        ], 201);
    }
}
