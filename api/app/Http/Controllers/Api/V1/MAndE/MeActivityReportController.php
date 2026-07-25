<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Http\Requests\MAndE\StoreActivityReportRequest;
use App\Http\Requests\MAndE\UpdateActivityReportRequest;
use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Modules\MAndE\Services\MeActivityReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeActivityReportController extends Controller
{
    public function __construct(private readonly MeActivityReportService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'review_status', 'programme_id', 'thematic_area_id', 'strategic_goal_id', 'search', 'per_page',
        ]);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function show(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        return response()->json(['data' => $this->service->get($activityReport)]);
    }

    public function store(StoreActivityReportRequest $request): JsonResponse
    {
        $report = $this->service->create($request->validated(), $request->user());
        return response()->json(['message' => 'Activity report created.', 'data' => $report], 201);
    }

    public function update(UpdateActivityReportRequest $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        $report = $this->service->update($activityReport, $request->validated(), $request->user());
        return response()->json(['message' => 'Activity report updated.', 'data' => $report]);
    }

    public function destroy(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        $this->service->delete($activityReport, $request->user());
        return response()->json(['message' => 'Activity report deleted.']);
    }

    /**
     * PIF linkages: approved programmes (with a flag indicating whether they
     * already have an activity report) for linking in the activity-report form.
     */
    public function linkablePifs(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $reportedIds = MeActivityReport::where('tenant_id', $tenantId)
            ->distinct()
            ->pluck('programme_id')
            ->all();

        $query = Programme::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['approved', 'amended']);

        if ($request->boolean('unlinked')) {
            $query->whereNotIn('id', $reportedIds);
        }

        $programmes = $query
            ->withCount(['attachments'])
            ->orderByDesc('approved_at')
            ->get(['id', 'reference_number', 'title', 'strategic_pillar', 'responsible_officer_id', 'start_date', 'end_date', 'approved_at']);

        $data = $programmes->map(function (Programme $p) use ($reportedIds) {
            return [
                'id'               => $p->id,
                'reference_number' => $p->reference_number,
                'title'            => $p->title,
                'strategic_pillar' => $p->strategic_pillar,
                'start_date'       => $p->start_date,
                'end_date'         => $p->end_date,
                'has_report'       => in_array($p->id, $reportedIds, true),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function history(Request $request, MeActivityReport $activityReport): JsonResponse
    {
        $this->ensureTenant($request, $activityReport);
        $history = $activityReport->history()->with('actor:id,name')->orderBy('created_at')->get();
        return response()->json(['data' => $history]);
    }

    public function markNotReportable(Request $request, Programme $programme): JsonResponse
    {
        abort_unless((int) $programme->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        $report = app(\App\Modules\MAndE\Services\MeIntakeService::class)
            ->markNotReportable($programme, $request->user(), $data['reason']);

        return response()->json([
            'message' => 'PIF marked not reportable for M&E.',
            'data'    => $report,
        ]);
    }

    private function ensureTenant(Request $request, MeActivityReport $report): void
    {
        if ((int) $report->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
