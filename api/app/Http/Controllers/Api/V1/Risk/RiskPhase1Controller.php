<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\Risk;
use App\Models\RiskAcceptance;
use App\Models\RiskControl;
use App\Models\RiskIncident;
use App\Modules\Risk\Services\RiskAcceptanceService;
use App\Modules\Risk\Services\RiskAppetiteService;
use App\Modules\Risk\Services\RiskAssessmentService;
use App\Modules\Risk\Services\RiskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskPhase1Controller extends Controller
{
    public function __construct(
        private readonly RiskService $risks,
        private readonly RiskAssessmentService $assessments,
        private readonly RiskAcceptanceService $acceptances,
        private readonly RiskAppetiteService $appetite,
    ) {}

    public function storeAssessment(Request $request, Risk $risk): JsonResponse
    {
        $this->assertTenant($risk, $request);

        $data = $request->validate([
            'assessment_type' => ['required', 'in:inherent,residual'],
            'likelihood' => ['required', 'integer', 'min:1', 'max:5'],
            'impact' => ['required', 'integer', 'min:1', 'max:5'],
            'rationale' => ['nullable', 'string', 'max:5000'],
            'control_reduction_pct' => ['prohibited'],
            'controls_reduce_percent' => ['prohibited'],
        ]);

        $assessment = $this->assessments->record($risk, $data, $request->user());

        return response()->json(['message' => 'Assessment recorded.', 'data' => $assessment], 201);
    }

    public function listAssessments(Request $request, Risk $risk): JsonResponse
    {
        $this->assertTenant($risk, $request);

        return response()->json(['data' => $this->assessments->history($risk)]);
    }

    public function requestAcceptance(Request $request, Risk $risk): JsonResponse
    {
        $this->assertTenant($risk, $request);

        $data = $request->validate([
            'justification' => ['required', 'string', 'max:5000'],
            'expires_at' => ['required', 'date', 'after:today'],
        ]);

        $acceptance = $this->acceptances->request($risk, $data, $request->user());

        return response()->json(['message' => 'Acceptance requested.', 'data' => $acceptance], 201);
    }

    public function decideAcceptance(Request $request, RiskAcceptance $acceptance): JsonResponse
    {
        if ((int) $acceptance->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'decision_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->acceptances->decide($acceptance, $data, $request->user());

        return response()->json(['message' => 'Acceptance decision recorded.', 'data' => $updated]);
    }

    public function materialise(Request $request, Risk $risk): JsonResponse
    {
        $this->assertTenant($risk, $request);

        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:5000'],
            'create_incident' => ['nullable', 'boolean'],
            'incident_title' => ['nullable', 'string', 'max:300'],
            'incident_description' => ['nullable', 'string', 'max:5000'],
            'severity' => ['nullable', 'in:low,medium,high,critical'],
            'occurred_at' => ['nullable', 'date'],
        ]);

        $updated = $this->risks->materialise($risk, $data, $request->user());

        return response()->json(['message' => 'Risk materialised (remains open until deliberately closed).', 'data' => $updated]);
    }

    public function storeControl(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:300'],
            'description' => ['nullable', 'string', 'max:5000'],
            'control_type' => ['nullable', 'in:preventive,detective,corrective,directive'],
            'control_owner_id' => ['nullable', 'integer', 'exists:users,id'],
            'effectiveness' => ['nullable', 'in:none,partial,adequate,strong,ineffective'],
            'frequency' => ['nullable', 'string', 'max:30'],
            'control_code' => ['nullable', 'string', 'max:40'],
        ]);

        $this->risks->assertValidOwners(['control_owner_id' => $data['control_owner_id'] ?? null], $request->user());

        $control = RiskControl::create([
            'tenant_id' => $request->user()->tenant_id,
            'control_code' => $data['control_code'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'control_type' => $data['control_type'] ?? 'preventive',
            'control_owner_id' => $data['control_owner_id'] ?? null,
            'effectiveness' => $data['effectiveness'] ?? 'partial',
            'frequency' => $data['frequency'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Control created.', 'data' => $control], 201);
    }

    public function linkControl(Request $request, Risk $risk): JsonResponse
    {
        $this->assertTenant($risk, $request);

        $data = $request->validate([
            'control_id' => ['required', 'integer', 'exists:risk_controls,id'],
            'effectiveness_rating' => ['nullable', 'in:none,partial,adequate,strong,ineffective'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $control = RiskControl::where('tenant_id', $request->user()->tenant_id)->findOrFail($data['control_id']);

        $risk->controls()->syncWithoutDetaching([
            $control->id => [
                'effectiveness_rating' => $data['effectiveness_rating'] ?? $control->effectiveness,
                'notes' => $data['notes'] ?? null,
                'linked_by' => $request->user()->id,
            ],
        ]);

        return response()->json(['message' => 'Control linked.', 'data' => $risk->fresh('controls')]);
    }

    public function storeIncident(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:300'],
            'description' => ['required', 'string', 'max:5000'],
            'risk_id' => ['nullable', 'integer', 'exists:risks,id'],
            'severity' => ['nullable', 'in:low,medium,high,critical'],
            'occurred_at' => ['nullable', 'date'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'is_confidential' => ['nullable', 'boolean'],
        ]);

        $incident = RiskIncident::create([
            'tenant_id' => $request->user()->tenant_id,
            'title' => $data['title'],
            'description' => $data['description'],
            'risk_id' => $data['risk_id'] ?? null,
            'severity' => $data['severity'] ?? 'medium',
            'occurred_at' => $data['occurred_at'] ?? now(),
            'reported_by' => $request->user()->id,
            'department_id' => $data['department_id'] ?? null,
            'is_confidential' => (bool) ($data['is_confidential'] ?? false),
        ]);

        return response()->json(['message' => 'Incident recorded.', 'data' => $incident], 201);
    }

    public function listIncidents(Request $request): JsonResponse
    {
        $query = RiskIncident::query()->where('tenant_id', $request->user()->tenant_id)->orderByDesc('created_at');

        if (! $this->risks->canSeeConfidential($request->user())) {
            $query->where(function ($q) use ($request) {
                $q->where('is_confidential', false)->orWhere('reported_by', $request->user()->id);
            });
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function appetiteIndex(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->appetite->list((int) $request->user()->tenant_id)]);
    }

    public function appetiteStore(Request $request): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
            abort(403);
        }

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:200'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
            'matrix_thresholds' => ['nullable', 'array'],
            'acceptance_authority' => ['nullable', 'array'],
            'tolerance_statement' => ['nullable', 'string'],
            'activate' => ['nullable', 'boolean'],
        ]);

        $policy = $this->appetite->createVersion($data, $request->user());

        return response()->json(['message' => 'Appetite policy version created.', 'data' => $policy], 201);
    }

    public function appetiteActivate(Request $request, int $policy): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
            abort(403);
        }

        $model = \App\Models\RiskAppetitePolicy::where('tenant_id', $request->user()->tenant_id)->findOrFail($policy);
        $activated = $this->appetite->activate($model, $request->user());

        return response()->json(['message' => 'Appetite policy activated.', 'data' => $activated]);
    }

    public function acceptProposal(Request $request, Risk $risk): JsonResponse
    {
        $this->assertTenant($risk, $request);
        if (! $request->user()->hasAnyRole(['Governance Officer', 'HOD', 'Director', 'System Admin', 'super-admin'])) {
            abort(403);
        }

        return response()->json(['message' => 'Proposal accepted into register.', 'data' => $this->risks->acceptProposal($risk, $request->user())]);
    }

    public function rejectProposal(Request $request, Risk $risk): JsonResponse
    {
        $this->assertTenant($risk, $request);
        if (! $request->user()->hasAnyRole(['Governance Officer', 'HOD', 'Director', 'System Admin', 'super-admin'])) {
            abort(403);
        }

        $data = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);

        return response()->json(['message' => 'Proposal rejected.', 'data' => $this->risks->rejectProposal($risk, $request->user(), $data['notes'] ?? null)]);
    }

    private function assertTenant(Risk $risk, Request $request): void
    {
        if ((int) $risk->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
