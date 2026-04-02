<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\Risk;
use App\Modules\Risk\Services\RiskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskController extends Controller
{
    public function __construct(private readonly RiskService $riskService) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'category', 'risk_level', 'search', 'per_page']);
        return response()->json($this->riskService->list($filters, $request->user()));
    }

    public function show(Risk $risk): JsonResponse
    {
        $risk = Risk::where('id', $risk->id)
            ->where('tenant_id', request()->user()->tenant_id)
            ->firstOrFail();

        return response()->json([
            'data' => $risk->load(['submitter', 'riskOwner', 'actionOwner', 'reviewer', 'approver', 'closer', 'department', 'actions', 'history.actor']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'                => ['required', 'string', 'max:300'],
            'description'          => ['required', 'string', 'max:5000'],
            'category'             => ['required', 'string', 'in:strategic,operational,financial,compliance,reputational,security,other'],
            'likelihood'           => ['required', 'integer', 'min:1', 'max:5'],
            'impact'               => ['required', 'integer', 'min:1', 'max:5'],
            'department_id'        => ['nullable', 'integer', 'exists:departments,id'],
            'risk_owner_id'        => ['nullable', 'integer', 'exists:users,id'],
            'action_owner_id'      => ['nullable', 'integer', 'exists:users,id'],
            'control_effectiveness'=> ['nullable', 'string', 'in:none,partial,adequate,strong'],
            'review_frequency'     => ['nullable', 'string', 'in:monthly,quarterly,bi_annual,annual'],
            'next_review_date'     => ['nullable', 'date'],
        ]);

        $risk = $this->riskService->create($data, $request->user());
        return response()->json(['message' => 'Risk created.', 'data' => $risk], 201);
    }

    public function update(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'title'                => ['sometimes', 'string', 'max:300'],
            'description'          => ['sometimes', 'string', 'max:5000'],
            'category'             => ['sometimes', 'string', 'in:strategic,operational,financial,compliance,reputational,security,other'],
            'likelihood'           => ['sometimes', 'integer', 'min:1', 'max:5'],
            'impact'               => ['sometimes', 'integer', 'min:1', 'max:5'],
            'department_id'        => ['nullable', 'integer', 'exists:departments,id'],
            'risk_owner_id'        => ['nullable', 'integer', 'exists:users,id'],
            'action_owner_id'      => ['nullable', 'integer', 'exists:users,id'],
            'control_effectiveness'=> ['nullable', 'string', 'in:none,partial,adequate,strong'],
            'review_frequency'     => ['nullable', 'string', 'in:monthly,quarterly,bi_annual,annual'],
            'next_review_date'     => ['nullable', 'date'],
            'review_notes'         => ['nullable', 'string', 'max:2000'],
            'residual_likelihood'  => ['nullable', 'integer', 'min:1', 'max:5'],
            'residual_impact'      => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $updated = $this->riskService->update($risk, $data, $request->user());
        return response()->json(['message' => 'Risk updated.', 'data' => $updated]);
    }

    public function destroy(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if (!$risk->isDraft()) {
            return response()->json(['message' => 'Only draft risks can be deleted.'], 422);
        }

        $this->riskService->delete($risk, $request->user());
        return response()->json(['message' => 'Risk deleted.']);
    }

    public function submit(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        // Only submitter or admin can submit
        $canSubmit = (int) $risk->submitted_by === (int) $request->user()->id
            || $request->user()->hasAnyRole(['System Admin', 'super-admin']);

        if (!$canSubmit) {
            abort(403, 'You are not allowed to submit this risk.');
        }

        $updated = $this->riskService->submit($risk, $request->user());
        return response()->json(['message' => 'Risk submitted.', 'data' => $updated]);
    }

    public function startReview(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if (!$request->user()->hasAnyRole([
            'HOD', 'Director', 'Governance Officer', 'Internal Auditor',
            'System Admin', 'super-admin',
        ])) {
            abort(403);
        }

        $updated = $this->riskService->startReview($risk, $request->user());
        return response()->json(['message' => 'Risk review started.', 'data' => $updated]);
    }

    public function approve(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if (!$request->user()->hasAnyRole([
            'Director', 'Secretary General', 'System Admin', 'super-admin',
        ])) {
            abort(403);
        }

        $data = $request->validate([
            'review_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->riskService->approve($risk, $data, $request->user());
        return response()->json(['message' => 'Risk approved.', 'data' => $updated]);
    }

    public function escalate(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if (!$request->user()->hasAnyRole([
            'HOD', 'Director', 'Governance Officer', 'Secretary General',
            'System Admin', 'super-admin',
        ])) {
            abort(403);
        }

        $data = $request->validate([
            'escalation_level' => ['required', 'string', 'in:none,departmental,directorate,sg,committee'],
            'notes'            => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->riskService->escalate($risk, $data, $request->user());
        return response()->json(['message' => 'Risk escalated.', 'data' => $updated]);
    }

    public function close(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if (!$request->user()->hasAnyRole([
            'Director', 'Secretary General', 'System Admin', 'super-admin',
        ])) {
            abort(403);
        }

        $data = $request->validate([
            'closure_evidence' => ['required', 'string', 'max:5000'],
            'notes'            => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->riskService->close($risk, $data, $request->user());
        return response()->json(['message' => 'Risk closed.', 'data' => $updated]);
    }

    public function archive(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if (!$request->user()->hasAnyRole([
            'Secretary General', 'System Admin', 'super-admin',
        ])) {
            abort(403);
        }

        $updated = $this->riskService->archive($risk, $request->user());
        return response()->json(['message' => 'Risk archived.', 'data' => $updated]);
    }

    public function reopen(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if (!$request->user()->hasAnyRole([
            'Director', 'Governance Officer', 'Secretary General',
            'System Admin', 'super-admin',
        ])) {
            abort(403);
        }

        $updated = $this->riskService->reopen($risk, $request->user());
        return response()->json(['message' => 'Risk reopened.', 'data' => $updated]);
    }

    public function logs(Request $request, Risk $risk): JsonResponse
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $history = $risk->history()
            ->with('actor')
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $history]);
    }

    public function auditTrail(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->per_page ?? 25), 100);

        $results = \App\Models\RiskHistory::with([
                'risk:id,risk_code,title',
                'actor:id,name',
            ])
            ->whereHas('risk', fn($q) => $q->where('tenant_id', $request->user()->tenant_id))
            ->when($request->filled('change_type'), fn($q) => $q->where('change_type', $request->change_type))
            ->when($request->filled('date_from'),   fn($q) => $q->whereDate('created_at', '>=', $request->date_from))
            ->when($request->filled('date_to'),     fn($q) => $q->whereDate('created_at', '<=', $request->date_to))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($results);
    }
}
