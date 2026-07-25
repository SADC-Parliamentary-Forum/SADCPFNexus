<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Models\MeActivityReport;
use App\Models\MeFollowUpAction;
use App\Modules\MAndE\Services\MeFollowUpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeFollowUpController extends Controller
{
    public function __construct(private readonly MeFollowUpService $service) {}

    public function index(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);

        return response()->json(['data' => $this->service->listForReport($activityReport)]);
    }

    public function store(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        $data = $request->validate([
            'action'      => ['required', 'string', 'max:1000'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'due_date'    => ['nullable', 'date'],
            'priority'    => ['nullable', 'string', 'in:low,normal,high,urgent'],
            'status'      => ['nullable', 'string', 'in:open,in_progress,completed,cancelled'],
            'comments'    => ['nullable', 'string', 'max:5000'],
        ]);

        $row = $this->service->create($activityReport, $data, $request->user());

        return response()->json(['message' => 'Follow-up action created.', 'data' => $row], 201);
    }

    public function update(Request $request, MeActivityReport $activityReport, MeFollowUpAction $followUp): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        abort_unless((int) $followUp->me_activity_report_id === (int) $activityReport->id, 404);

        $data = $request->validate([
            'action'      => ['sometimes', 'string', 'max:1000'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'due_date'    => ['nullable', 'date'],
            'priority'    => ['nullable', 'string', 'in:low,normal,high,urgent'],
            'status'      => ['nullable', 'string', 'in:open,in_progress,completed,cancelled'],
            'comments'    => ['nullable', 'string', 'max:5000'],
        ]);

        $row = $this->service->update($followUp, $data, $request->user());

        return response()->json(['message' => 'Follow-up action updated.', 'data' => $row]);
    }

    public function destroy(Request $request, MeActivityReport $activityReport, MeFollowUpAction $followUp): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        abort_unless((int) $followUp->me_activity_report_id === (int) $activityReport->id, 404);
        $this->service->delete($followUp, $request->user());

        return response()->json(['message' => 'Follow-up action deleted.']);
    }

    private function ensureTenant(Request $request, MeActivityReport $report): void
    {
        abort_unless((int) $report->tenant_id === (int) $request->user()->tenant_id, 404);
    }
}
