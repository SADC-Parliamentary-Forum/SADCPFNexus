<?php

namespace App\Http\Controllers\Api\V1\WeeklyReports;

use App\Http\Controllers\Controller;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportDecisionRequest;
use App\Models\WeeklyReportItem;
use App\Models\WeeklyReportPriority;
use App\Models\WeeklyReportRisk;
use App\Modules\WeeklyReports\Services\WeeklyConsolidationService;
use App\Modules\WeeklyReports\Services\WeeklyExportService;
use App\Modules\WeeklyReports\Services\WeeklyPeriodService;
use App\Modules\WeeklyReports\Services\WeeklyReportService;
use App\Modules\WeeklyReports\Services\WeeklyTrendAnalyticsService;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeeklyReportController extends Controller
{
    public function __construct(
        private readonly WeeklyReportService $reports,
        private readonly WeeklyPeriodService $periods,
        private readonly WeeklyConsolidationService $consolidation,
        private readonly WeeklyExportService $exports,
        private readonly WeeklyTrendAnalyticsService $trends,
        private readonly WorkflowService $workflowService,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reports->dashboard($request->user())]);
    }

    public function reviewQueue(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reports->reviewQueue($request->user())]);
    }

    public function trends(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return response()->json([
            'data' => $this->trends->trends($request->user(), $data['from'] ?? null, $data['to'] ?? null),
        ]);
    }

    public function periods(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->periods->list($request->user())]);
    }

    public function storePeriod(Request $request): JsonResponse
    {
        $data = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'reference' => 'nullable|string|max:40',
            'employee_due_at' => 'nullable|date',
            'status' => 'nullable|string|max:40',
        ]);

        $period = $this->periods->create($request->user(), $data);

        return response()->json(['data' => $period], 201);
    }

    public function current(Request $request): JsonResponse
    {
        $report = $this->reports->findOrCreateIndividual(
            $request->user(),
            $request->integer('period_id') ?: null
        );

        return response()->json(['data' => $report]);
    }

    public function store(Request $request): JsonResponse
    {
        $report = $this->reports->findOrCreateIndividual(
            $request->user(),
            $request->integer('period_id') ?: null
        );

        return response()->json(['data' => $report], 201);
    }

    public function show(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        return response()->json(['data' => $this->reports->show($weeklySummary, $request->user())]);
    }

    public function update(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'additional_notes' => 'nullable|string',
            'work_location_status' => 'nullable|string|max:60',
            'no_activity' => 'nullable|boolean',
            'confidentiality' => 'nullable|string|max:40',
            'status' => 'nullable|string|max:40',
            'programme_id' => 'nullable|integer',
            'project_id' => 'nullable|integer',
            'donor_code' => 'nullable|string|max:64',
            'donor_name' => 'nullable|string|max:255',
            'template_key' => 'nullable|string|max:64',
        ]);

        return response()->json(['data' => $this->reports->update($weeklySummary, $request->user(), $data)]);
    }

    public function storeItem(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'section_type' => 'required|string|max:40',
            'title' => 'required|string|max:255',
            'narrative' => 'nullable|string',
            'source_type' => 'nullable|string|max:64',
            'source_id' => 'nullable|integer',
            'source_reference_snapshot' => 'nullable|string|max:255',
            'source_status_snapshot' => 'nullable|string|max:60',
            'result_or_expected_outcome' => 'nullable|string',
            'due_date' => 'nullable|date',
            'priority' => 'nullable|string|max:20',
            'confidentiality' => 'nullable|string|max:40',
            'structured' => 'nullable|array',
            // structured section helpers
            'problem' => 'nullable|string',
            'impact' => 'nullable|string',
            'decision_requested' => 'nullable|string',
            'priority_text' => 'nullable|string',
            'emerging_issue' => 'nullable|string',
            'support_needed' => 'nullable|string',
            'kind' => 'nullable|in:item,blocker,decision,priority,risk,support',
        ]);

        $kind = $data['kind'] ?? 'item';
        $created = match ($kind) {
            'blocker' => $this->reports->addBlocker($weeklySummary, $request->user(), $data + ['problem' => $data['problem'] ?? $data['title']]),
            'decision' => $this->reports->addDecisionRequest($weeklySummary, $request->user(), $data + ['decision_requested' => $data['decision_requested'] ?? $data['title']]),
            'priority' => $this->reports->addPriority($weeklySummary, $request->user(), $data + ['priority_text' => $data['priority_text'] ?? $data['title']]),
            'risk' => $this->reports->addRisk($weeklySummary, $request->user(), $data + ['emerging_issue' => $data['emerging_issue'] ?? $data['title']]),
            'support' => $this->reports->addSupport($weeklySummary, $request->user(), $data + ['support_needed' => $data['support_needed'] ?? $data['title']]),
            default => $this->reports->addItem($weeklySummary, $request->user(), $data),
        };

        return response()->json(['data' => $created], 201);
    }

    public function submit(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $request->validate(['declaration_confirmed' => 'required|accepted']);

        return response()->json(['data' => $this->reports->submit($weeklySummary, $request->user())]);
    }

    public function generateAiDraft(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $suggestions = app(\App\Modules\WeeklyReports\Services\WeeklySuggestionService::class)
            ->suggestions($request->user(), $weeklySummary->period, $weeklySummary);

        $draft = app(\App\Modules\WeeklyReports\Services\WeeklyAiDraftService::class)
            ->generateStub($weeklySummary, $request->user(), $suggestions);

        return response()->json([
            'message' => 'AI draft generated from suggestions. Human confirmation required before submit — never auto-submitted.',
            'data' => $draft,
        ]);
    }

    public function confirmAiDraft(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $request->validate(['confirm' => 'required|accepted']);

        $report = app(\App\Modules\WeeklyReports\Services\WeeklyAiDraftService::class)
            ->confirm($weeklySummary, $request->user());

        return response()->json([
            'message' => 'AI draft confirmed by human. Report not submitted.',
            'data' => $report,
        ]);
    }

    public function returnReport(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'reason' => 'required|string',
            'correction_requested' => 'nullable|string',
            'section_or_item' => 'nullable|string',
            'comments' => 'nullable|string',
            'resubmission_due_date' => 'nullable|date',
            'is_confidential' => 'nullable|boolean',
        ]);

        $approvalRequest = $weeklySummary->approvalRequest;
        if ($approvalRequest) {
            $this->workflowService->returnForCorrection($approvalRequest, $request->user(), $data['reason']);

            return response()->json(['data' => $weeklySummary->fresh()]);
        }

        return response()->json(['data' => $this->reports->returnReport($weeklySummary, $request->user(), $data)]);
    }

    public function accept(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'comments' => 'nullable|string',
            'comment_type' => 'nullable|string',
            'is_confidential' => 'nullable|boolean',
        ]);

        $approvalRequest = $weeklySummary->approvalRequest;
        if ($approvalRequest) {
            $this->workflowService->approve($approvalRequest, $request->user(), $data['comments'] ?? null);

            return response()->json(['data' => $weeklySummary->fresh()]);
        }

        return response()->json(['data' => $this->reports->accept($weeklySummary, $request->user(), $data)]);
    }

    public function reopen(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate(['reason' => 'required|string']);

        return response()->json(['data' => $this->reports->reopen($weeklySummary, $request->user(), $data['reason'])]);
    }

    public function suggestions(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->reports->currentSuggestions($request->user(), $request->integer('period_id') ?: null),
        ]);
    }

    public function includeSuggestion(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'source_type' => 'required|string|max:64',
            'source_id' => 'required|integer',
            'suggested_section' => 'nullable|string|max:40',
            'title' => 'nullable|string|max:255',
            'narrative' => 'nullable|string',
            'reference' => 'nullable|string',
            'status' => 'nullable|string',
            'confidentiality' => 'nullable|string|max:40',
        ]);

        return response()->json(['data' => $this->reports->includeSuggestion($weeklySummary, $request->user(), $data)]);
    }

    public function excludeSuggestion(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'source_type' => 'required|string|max:64',
            'source_id' => 'required|integer',
            'suggested_section' => 'nullable|string|max:40',
        ]);

        return response()->json(['data' => $this->reports->excludeSuggestion($weeklySummary, $request->user(), $data)]);
    }

    public function department(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period_id' => 'required|integer',
            'department_id' => 'nullable|integer',
        ]);

        $report = $this->consolidation->findOrCreateDepartment(
            $request->user(),
            (int) $data['period_id'],
            isset($data['department_id']) ? (int) $data['department_id'] : null
        );

        $extra = $this->reports->departmentStaffRollup($request->user(), $report);

        return response()->json(['data' => array_merge($report->toArray(), $extra)], 201);
    }

    public function institutional(Request $request): JsonResponse
    {
        $data = $request->validate(['period_id' => 'required|integer']);
        $report = $this->consolidation->findOrCreateInstitutional($request->user(), (int) $data['period_id']);

        return response()->json(['data' => $report], 201);
    }

    public function consolidateItem(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'source_entity_type' => 'required|string',
            'source_entity_id' => 'required|integer',
            'edited_narrative' => 'nullable|string',
            'title' => 'nullable|string',
            'section_type' => 'nullable|string',
        ]);

        return response()->json(['data' => $this->consolidation->consolidateItem($weeklySummary, $request->user(), $data)]);
    }

    public function publish(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        return response()->json(['data' => $this->consolidation->publish($weeklySummary, $request->user())]);
    }

    public function createAssignmentFromItem(Request $request, WeeklyReportItem $weeklySummaryItem): JsonResponse
    {
        $data = $request->validate([
            'title' => 'nullable|string',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|integer',
        ]);

        $assignment = $this->reports->createAssignmentFromItem($weeklySummaryItem, $request->user(), $data);

        return response()->json(['data' => $assignment], 201);
    }

    public function createRiskFromWeekly(Request $request, WeeklyReportRisk $weeklyReportRisk): JsonResponse
    {
        $data = $request->validate([
            'title' => 'nullable|string|max:300',
            'description' => 'nullable|string|max:5000',
            'category' => 'nullable|string|in:strategic,operational,financial,compliance,reputational,security,other',
            'likelihood' => 'nullable|integer|min:1|max:5',
            'impact' => 'nullable|integer|min:1|max:5',
            'strategic_objective_id' => 'nullable|integer|exists:strategic_objectives,id',
            'risk_owner_id' => 'nullable|integer|exists:users,id',
            'cause' => 'nullable|string|max:5000',
        ]);

        $risk = $this->reports->createRiskFromWeeklyRisk($weeklyReportRisk, $request->user(), $data);

        return response()->json(['message' => 'Risk proposal created from weekly emerging risk.', 'data' => $risk], 201);
    }

    public function recordDecision(Request $request, WeeklyReportDecisionRequest $weeklySummaryItem): JsonResponse
    {
        $data = $request->validate([
            'decision_recorded' => 'required|string',
            'create_assignment' => 'nullable|boolean',
            'create_risk' => 'nullable|boolean',
            'title' => 'nullable|string',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|integer',
            'likelihood' => 'nullable|integer|min:1|max:5',
            'impact' => 'nullable|integer|min:1|max:5',
        ]);

        return response()->json(['data' => $this->reports->recordDecision($weeklySummaryItem, $request->user(), $data)]);
    }

    public function carryForward(Request $request, WeeklyReportPriority $weeklySummaryItem): JsonResponse
    {
        $data = $request->validate(['target_report_id' => 'required|integer']);
        $target = WeeklyReport::findOrFail($data['target_report_id']);
        $priority = $this->reports->carryForwardPriority($weeklySummaryItem, $target, $request->user());

        return response()->json(['data' => $priority], 201);
    }

    public function exemptions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period_id' => 'required|integer',
            'employee_id' => 'required|integer',
            'reason' => 'nullable|string',
            'leave_request_id' => 'nullable|integer',
            'notes' => 'nullable|string',
        ]);

        return response()->json(['data' => $this->reports->grantExemption($request->user(), $data)], 201);
    }

    public function extendDeadline(Request $request, WeeklyReport $weeklySummary): JsonResponse
    {
        $data = $request->validate([
            'new_due_at' => 'required|date',
            'reason' => 'nullable|string',
        ]);

        return response()->json(['data' => $this->reports->extendDeadline($weeklySummary, $request->user(), $data)]);
    }

    public function export(Request $request, WeeklyReport $weeklySummary, string $format)
    {
        return match ($format) {
            'pdf' => $this->exports->pdf($weeklySummary, $request->user())->download($weeklySummary->reference.'.pdf'),
            'excel', 'csv' => $this->exports->excelCsv($weeklySummary, $request->user()),
            'word', 'doc' => $this->exports->wordDoc($weeklySummary, $request->user()),
            'docx' => $this->exports->wordDocx($weeklySummary, $request->user()),
            'management-pack' => $this->exports->managementPackDocx($weeklySummary, $request->user()),
            default => response()->json(['message' => 'Unsupported format'], 422),
        };
    }
}
