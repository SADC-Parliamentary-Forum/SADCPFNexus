<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Reports\Services\ReportManagementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ReportsManagementController extends Controller
{
    public function __construct(private readonly ReportManagementService $reports) {}

    public function schedules(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reports->schedules((int) $request->user()->tenant_id, $request->user())]);
    }

    public function createSchedule(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('reports.schedule'), 403);
        $data = $request->validate([
            'report_key' => 'required|string|max:120',
            'label' => 'required|string|max:180',
            'format' => 'required|string|in:csv,pdf,xlsx',
            'filters' => 'nullable|array',
            'recipients' => 'required|array|min:1|max:25',
            'recipients.*' => 'email',
            'frequency' => 'required|string|in:daily,weekly,monthly',
            'timezone' => 'nullable|string|max:80',
            'next_run_at' => 'nullable|date',
        ]);

        return response()->json(['data' => $this->reports->createSchedule((int) $request->user()->tenant_id, $data, $request->user())], 201);
    }

    public function approveSchedule(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->can('reports.manage-schedules'), 403);

        return response()->json(['data' => $this->reports->approveSchedule((int) $request->user()->tenant_id, $id, $request->user())]);
    }

    public function pauseSchedule(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->can('reports.manage-schedules'), 403);

        return response()->json(['data' => $this->reports->pauseSchedule((int) $request->user()->tenant_id, $id, $request->user())]);
    }

    public function exportEvents(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reports->exportEvents((int) $request->user()->tenant_id, $request->user())]);
    }

    public function downloadExport(Request $request, int $id)
    {
        abort_unless($request->user()->can('reports.export') || $request->user()->can('reports.audit'), 403);
        $export = $this->reports->exportFile((int) $request->user()->tenant_id, $id);
        abort_unless(Storage::disk('local')->exists($export['file_path']), 404, 'The report file is no longer available.');

        $extension = match (strtolower((string) ($export['format'] ?? 'csv'))) {
            'pdf' => 'pdf',
            'xlsx' => 'xlsx',
            default => 'csv',
        };

        return Storage::disk('local')->download($export['file_path'], ($export['reference'] ?? 'report-export') . '.' . $extension);
    }
}
