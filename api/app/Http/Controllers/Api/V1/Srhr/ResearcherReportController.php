<?php

namespace App\Http\Controllers\Api\V1\Srhr;

use App\Http\Controllers\Controller;
use App\Models\ResearcherReport;
use App\Modules\Srhr\Services\ResearcherReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResearcherReportController extends Controller
{
    public function __construct(private ResearcherReportService $service) {}

    private function checkPerm(Request $request, string $permission): void
    {
        $user = $request->user();
        if ($user->isSystemAdmin() || $user->hasAnyRole(['System Admin', 'HR Manager', 'HR Administrator'])) {
            return;
        }
        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo($permission, 'sanctum'), 403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.view');
        $result = $this->service->list($request->all(), $request->user());
        return response()->json($result);
    }

    public function show(Request $request, ResearcherReport $researcherReport): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.view');
        abort_unless((int) $researcherReport->tenant_id === (int) $request->user()->tenant_id, 404);
        $report = $this->service->get($researcherReport->id, $request->user());
        return response()->json(['data' => $report]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.submit');

        $data = $request->validate([
            'deployment_id'          => ['required', 'integer', 'exists:staff_deployments,id'],
            'report_type'            => ['required', 'string', 'in:monthly,quarterly,annual,ad_hoc'],
            'period_start'           => ['required', 'date'],
            'period_end'             => ['required', 'date', 'after:period_start'],
            'title'                  => ['required', 'string', 'max:500'],
            'executive_summary'      => ['nullable', 'string'],
            'activities_undertaken'  => ['nullable', 'array'],
            'activities_undertaken.*.title'       => ['required_with:activities_undertaken', 'string', 'max:255'],
            'activities_undertaken.*.description' => ['nullable', 'string'],
            'activities_undertaken.*.date'        => ['nullable', 'date'],
            'activities_undertaken.*.outcome'     => ['nullable', 'string'],
            'challenges_faced'       => ['nullable', 'string'],
            'recommendations'        => ['nullable', 'string'],
            'next_period_plan'       => ['nullable', 'string'],
            'srhr_indicators'        => ['nullable', 'array'],
        ]);

        $report = $this->service->create($data, $request->user());
        return response()->json(['message' => 'Report created.', 'data' => $report], 201);
    }

    public function update(Request $request, ResearcherReport $researcherReport): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.submit');
        abort_unless((int) $researcherReport->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'report_type'            => ['sometimes', 'string', 'in:monthly,quarterly,annual,ad_hoc'],
            'period_start'           => ['sometimes', 'date'],
            'period_end'             => ['sometimes', 'date'],
            'title'                  => ['sometimes', 'string', 'max:500'],
            'executive_summary'      => ['nullable', 'string'],
            'activities_undertaken'  => ['nullable', 'array'],
            'activities_undertaken.*.title'       => ['required_with:activities_undertaken', 'string', 'max:255'],
            'activities_undertaken.*.description' => ['nullable', 'string'],
            'activities_undertaken.*.date'        => ['nullable', 'date'],
            'activities_undertaken.*.outcome'     => ['nullable', 'string'],
            'challenges_faced'       => ['nullable', 'string'],
            'recommendations'        => ['nullable', 'string'],
            'next_period_plan'       => ['nullable', 'string'],
            'srhr_indicators'        => ['nullable', 'array'],
        ]);

        $report = $this->service->update($researcherReport, $data);
        return response()->json(['message' => 'Report updated.', 'data' => $report]);
    }

    public function destroy(Request $request, ResearcherReport $researcherReport): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.submit');
        abort_unless((int) $researcherReport->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$researcherReport->isDraft()) {
            return response()->json(['message' => 'Only draft reports can be deleted.'], 422);
        }

        $researcherReport->delete();
        return response()->json(['message' => 'Report deleted.']);
    }

    public function submit(Request $request, ResearcherReport $researcherReport): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.submit');
        abort_unless((int) $researcherReport->tenant_id === (int) $request->user()->tenant_id, 404);

        $report = $this->service->submit($researcherReport, $request->user());
        return response()->json(['message' => 'Report submitted.', 'data' => $report]);
    }

    public function acknowledge(Request $request, ResearcherReport $researcherReport): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.acknowledge');
        abort_unless((int) $researcherReport->tenant_id === (int) $request->user()->tenant_id, 404);

        $report = $this->service->acknowledge($researcherReport, $request->user());
        return response()->json(['message' => 'Report acknowledged.', 'data' => $report]);
    }

    public function requestRevision(Request $request, ResearcherReport $researcherReport): JsonResponse
    {
        $this->checkPerm($request, 'researcher_reports.acknowledge');
        abort_unless((int) $researcherReport->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'revision_notes' => ['required', 'string', 'max:2000'],
        ]);

        $report = $this->service->requestRevision($researcherReport, $data['revision_notes'], $request->user());
        return response()->json(['message' => 'Revision requested.', 'data' => $report]);
    }
}
