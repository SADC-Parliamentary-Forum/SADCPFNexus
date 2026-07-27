<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\BudgetCycle;
use App\Models\BudgetCycleDecision;
use App\Models\BudgetSubmission;
use App\Modules\Budget\Services\BudgetCycleService;
use App\Modules\Budget\Services\BudgetInstitutionalDecisionService;
use App\Modules\Budget\Services\BudgetSubmissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BudgetCycleController extends Controller
{
    public function __construct(
        private readonly BudgetCycleService $cycles,
        private readonly BudgetSubmissionService $submissions,
        private readonly BudgetInstitutionalDecisionService $decisions,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->cycles->listForTenant((int) $request->user()->tenant_id),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'financial_year_id' => ['required', 'integer', 'exists:financial_years,id'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $cycle = $this->cycles->open(
            (int) $request->user()->tenant_id,
            (int) $data['financial_year_id'],
            $request->user(),
            $data['notes'] ?? null,
        );

        return response()->json(['success' => true, 'data' => $cycle->load(['financialYear', 'guideline'])], 201);
    }

    public function show(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);

        $cycle->load([
            'financialYear',
            'guideline',
            'approvals.decidedBy',
            'decisions.recordedBy',
            'submissions.items',
            'submissions.department',
            'submissions.preparer',
        ]);

        return response()->json(['success' => true, 'data' => $cycle]);
    }

    public function publishGuidelines(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);
        $data = $request->validate([
            'submission_opens_on' => ['nullable', 'date'],
            'department_deadline' => ['nullable', 'date'],
            'assumptions' => ['nullable', 'string'],
            'inflation_rate' => ['nullable', 'numeric'],
            'fx_assumptions' => ['nullable', 'string'],
            'ceilings' => ['nullable', 'array'],
            'guidance_document_path' => ['nullable', 'string', 'max:500'],
        ]);

        $guideline = $this->cycles->publishGuidelines($cycle, $data, $request->user());

        return response()->json(['success' => true, 'data' => $guideline]);
    }

    public function advance(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);
        $data = $request->validate([
            'comments' => ['nullable', 'string', 'max:5000'],
        ]);

        $cycle = $this->cycles->advance($cycle, $request->user(), $data['comments'] ?? null);

        return response()->json(['success' => true, 'data' => $cycle]);
    }

    public function returnToDepartments(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:5000'],
        ]);

        $cycle = $this->cycles->returnToDepartments($cycle, $request->user(), $data['reason']);

        return response()->json(['success' => true, 'data' => $cycle]);
    }

    public function sgApprove(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);
        $data = $request->validate([
            'comments' => ['nullable', 'string', 'max:5000'],
            'approved_total' => ['nullable', 'numeric', 'min:0'],
        ]);

        $cycle = $this->cycles->sgApprove(
            $cycle,
            $request->user(),
            $data['comments'] ?? null,
            isset($data['approved_total']) ? (float) $data['approved_total'] : null,
        );

        return response()->json(['success' => true, 'data' => $cycle]);
    }

    public function lock(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);
        $cycle = $this->cycles->lock($cycle, $request->user());

        return response()->json(['success' => true, 'data' => $cycle]);
    }

    public function indexDecisions(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);

        return response()->json([
            'success' => true,
            'data' => $this->decisions->list($cycle),
        ]);
    }

    public function storeDecision(Request $request, BudgetCycle $cycle): JsonResponse
    {
        $this->assertCycleTenant($request, $cycle);

        $data = $request->validate([
            'body' => ['required', Rule::in(BudgetCycleDecision::BODIES)],
            'decision' => ['required', Rule::in(BudgetCycleDecision::DECISIONS)],
            'meeting_on' => ['nullable', 'date'],
            'minute_reference' => ['nullable', 'string', 'max:255'],
            'comments' => ['nullable', 'string', 'max:5000'],
            'attachment' => ['nullable', 'file', 'max:10240', 'mimes:pdf,doc,docx,jpg,jpeg,png'],
            'attachment_path' => ['nullable', 'string', 'max:500'],
        ]);

        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->store(
                'budget-cycle-decisions/'.$cycle->id,
                'local'
            );
            $data['attachment_path'] = $path;
        }

        unset($data['attachment']);

        $row = $this->decisions->record($cycle, $data, $request->user());

        return response()->json([
            'success' => true,
            'data' => [
                'decision' => $row,
                'cycle' => $cycle->fresh(['financialYear', 'guideline', 'approvals', 'decisions.recordedBy']),
            ],
        ], 201);
    }

    public function indexSubmissions(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'budget_cycle_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:40'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->submissions->list((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function storeSubmission(Request $request): JsonResponse
    {
        $data = $request->validate([
            'budget_cycle_id' => ['required', 'integer', 'exists:budget_cycles,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'programme_id' => ['nullable', 'integer', 'exists:programmes,id'],
            'type' => ['nullable', Rule::in(BudgetSubmission::TYPES)],
            'title' => ['required', 'string', 'max:255'],
            'require_hod_approval' => ['nullable', 'boolean'],
            'motivation' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.name' => ['required_with:items', 'string', 'max:255'],
            'items.*.requested_amount' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.code' => ['nullable', 'string', 'max:60'],
            'items.*.category' => ['nullable', 'string', 'max:80'],
            'items.*.funding_source_id' => ['nullable', 'integer', 'exists:funding_sources,id'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.justification' => ['nullable', 'string'],
            'items.*.prior_year_amount' => ['nullable', 'numeric'],
            'items.*.workplan_ref' => ['nullable', 'string', 'max:255'],
        ]);

        $submission = $this->submissions->create($data, $request->user());

        return response()->json(['success' => true, 'data' => $submission], 201);
    }

    public function showSubmission(Request $request, BudgetSubmission $submission): JsonResponse
    {
        if ((int) $submission->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $submission->load(['items.fundingSource', 'department', 'preparer', 'cycle.financialYear', 'approvalRequest']);

        return response()->json(['success' => true, 'data' => $submission]);
    }

    public function updateSubmission(Request $request, BudgetSubmission $submission): JsonResponse
    {
        $data = $request->validate([
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'programme_id' => ['nullable', 'integer', 'exists:programmes,id'],
            'type' => ['nullable', Rule::in(BudgetSubmission::TYPES)],
            'title' => ['nullable', 'string', 'max:255'],
            'require_hod_approval' => ['nullable', 'boolean'],
            'motivation' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.name' => ['required_with:items', 'string', 'max:255'],
            'items.*.requested_amount' => ['nullable', 'numeric', 'min:0.01'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.code' => ['nullable', 'string', 'max:60'],
            'items.*.category' => ['nullable', 'string', 'max:80'],
            'items.*.funding_source_id' => ['nullable', 'integer', 'exists:funding_sources,id'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.justification' => ['nullable', 'string'],
            'items.*.prior_year_amount' => ['nullable', 'numeric'],
            'items.*.workplan_ref' => ['nullable', 'string', 'max:255'],
        ]);

        $submission = $this->submissions->update($submission, $data, $request->user());

        return response()->json(['success' => true, 'data' => $submission]);
    }

    public function submitSubmission(Request $request, BudgetSubmission $submission): JsonResponse
    {
        $submission = $this->submissions->submit($submission, $request->user());

        return response()->json(['success' => true, 'data' => $submission]);
    }

    public function acceptSubmission(Request $request, BudgetSubmission $submission): JsonResponse
    {
        $submission = $this->submissions->accept($submission, $request->user());

        return response()->json(['success' => true, 'data' => $submission]);
    }

    public function consolidateSubmission(Request $request, BudgetSubmission $submission): JsonResponse
    {
        $submission = $this->submissions->consolidate($submission, $request->user());

        return response()->json(['success' => true, 'data' => $submission]);
    }

    public function returnSubmission(Request $request, BudgetSubmission $submission): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:5000'],
        ]);

        $submission = $this->submissions->returnToPreparer($submission, $request->user(), $data['reason']);

        return response()->json(['success' => true, 'data' => $submission]);
    }

    private function assertCycleTenant(Request $request, BudgetCycle $cycle): void
    {
        if ((int) $cycle->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
