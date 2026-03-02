<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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
            if (in_array($key, ['budget_lines', 'advance_types', 'classifications', 'leave_types', 'timesheet_projects'], true)) {
                $out[$key] = config("lookups.{$key}", []);
            }
        }

        return response()->json($out);
    }
}
