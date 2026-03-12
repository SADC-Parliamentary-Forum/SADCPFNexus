<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TimesheetProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LookupsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $keys = $request->get('keys', 'budget_lines,advance_types,classifications,leave_types');
        $keys = is_array($keys) ? $keys : array_map('trim', explode(',', (string) $keys));
        $out = [];

        foreach ($keys as $key) {
            if (in_array($key, ['budget_lines', 'advance_types', 'classifications', 'leave_types', 'timesheet_projects', 'travel_countries', 'travel_cities'], true)) {
                if ($key === 'timesheet_projects') {
                    $tenantId = $request->user()?->tenant_id;
                    $labels = TimesheetProject::when($tenantId !== null, fn ($q) => $q->where('tenant_id', $tenantId))
                        ->orderBy('sort_order')
                        ->orderBy('id')
                        ->pluck('label')
                        ->values()
                        ->all();
                    $out[$key] = count($labels) > 0 ? $labels : config('lookups.timesheet_projects', []);
                } else {
                    $out[$key] = config("lookups.{$key}", []);
                }
            }
        }

        return response()->json($out);
    }
}
