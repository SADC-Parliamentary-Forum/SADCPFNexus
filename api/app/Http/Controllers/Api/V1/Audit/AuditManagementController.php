<?php

namespace App\Http\Controllers\Api\V1\Audit;

use App\Http\Controllers\Controller;
use App\Models\AuditCorrectiveAction;
use App\Models\AuditEngagement;
use App\Models\AuditEvidenceRequest;
use App\Models\AuditExternalEngagement;
use App\Models\AuditFinding;
use App\Models\AuditLookup;
use App\Models\AuditModuleEvent;
use App\Models\AuditObservation;
use App\Models\AuditPlan;
use App\Models\AuditReport;
use App\Models\AuditUniverseEntity;
use App\Models\AuditWorkpaper;
use App\Modules\Audit\Services\AuditDashboardService;
use App\Modules\Audit\Services\AuditEngagementService;
use App\Modules\Audit\Services\AuditExternalService;
use App\Modules\Audit\Services\AuditFindingService;
use App\Modules\Audit\Services\AuditPlanService;
use App\Modules\Audit\Services\AuditReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditManagementController extends Controller
{
    public function __construct(
        private readonly AuditPlanService $plans,
        private readonly AuditEngagementService $engagements,
        private readonly AuditFindingService $findings,
        private readonly AuditReportService $reports,
        private readonly AuditExternalService $external,
        private readonly AuditDashboardService $dashboards,
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $view = $request->query('view', 'auditor');

        $data = match ($view) {
            'management' => $this->dashboards->management($user),
            'sg' => $this->dashboards->sg($user),
            default => $this->dashboards->auditor($user),
        };

        return response()->json(['data' => $data]);
    }

    public function lookups(Request $request): JsonResponse
    {
        $rows = AuditLookup::query()
            ->where(function ($q) use ($request) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $request->user()->tenant_id);
            })
            ->where('is_active', true)
            ->orderBy('category')
            ->orderBy('sort_order')
            ->get()
            ->groupBy('category');

        return response()->json(['data' => $rows]);
    }

    public function settings(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->plans->settings($request->user())]);
    }

    public function events(Request $request): JsonResponse
    {
        $rows = AuditModuleEvent::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rows);
    }

    // ── Universe ─────────────────────────────────────────────────────────────

    public function universeIndex(Request $request): JsonResponse
    {
        return response()->json($this->engagements->listUniverse($request->all(), $request->user()));
    }

    public function universeStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'entity_type' => ['nullable', 'string', 'max:64'],
            'department_id' => ['nullable', 'integer'],
            'owner_name' => ['nullable', 'string', 'max:255'],
            'owner_user_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'risk_profile' => ['nullable', 'string', 'max:32'],
            'inherent_risk_score' => ['nullable', 'integer', 'min:1', 'max:25'],
            'status' => ['nullable', 'string', 'max:32'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);
        $entity = $this->engagements->createUniverseEntity($data, $request->user());

        return response()->json(['message' => 'Universe entity created.', 'data' => $entity], 201);
    }

    public function universeUpdate(Request $request, AuditUniverseEntity $universe): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'entity_type' => ['nullable', 'string', 'max:64'],
            'department_id' => ['nullable', 'integer'],
            'owner_name' => ['nullable', 'string', 'max:255'],
            'owner_user_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'risk_profile' => ['nullable', 'string', 'max:32'],
            'inherent_risk_score' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:32'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);
        $entity = $this->engagements->updateUniverseEntity($universe, $data, $request->user());

        return response()->json(['message' => 'Universe entity updated.', 'data' => $entity]);
    }

    // ── Plans ────────────────────────────────────────────────────────────────

    public function plansIndex(Request $request): JsonResponse
    {
        return response()->json($this->plans->list($request->all(), $request->user()));
    }

    public function plansStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'fiscal_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'summary' => ['nullable', 'string'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);
        $plan = $this->plans->create($data, $request->user());

        return response()->json(['message' => 'Audit plan created.', 'data' => $plan], 201);
    }

    public function plansShow(Request $request, AuditPlan $plan): JsonResponse
    {
        if ((int) $plan->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json(['data' => $plan->load(['versions', 'approvals', 'engagements'])]);
    }

    public function plansUpdate(Request $request, AuditPlan $plan): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'summary' => ['nullable', 'string'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->plans->updateDraft($plan, $data, $request->user())]);
    }

    public function plansSubmit(Request $request, AuditPlan $plan): JsonResponse
    {
        $data = $request->validate(['comments' => ['nullable', 'string']]);

        return response()->json(['data' => $this->plans->submitForApproval($plan, $request->user(), $data['comments'] ?? null)]);
    }

    public function plansApprove(Request $request, AuditPlan $plan): JsonResponse
    {
        $data = $request->validate(['comments' => ['nullable', 'string']]);

        return response()->json(['data' => $this->plans->approve($plan, $request->user(), $data['comments'] ?? null)]);
    }

    public function plansReject(Request $request, AuditPlan $plan): JsonResponse
    {
        $data = $request->validate(['comments' => ['nullable', 'string']]);

        return response()->json(['data' => $this->plans->reject($plan, $request->user(), $data['comments'] ?? null)]);
    }

    public function plansAmend(Request $request, AuditPlan $plan): JsonResponse
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'summary' => ['nullable', 'string'],
            'amendment_reason' => ['required', 'string'],
        ]);

        return response()->json(['data' => $this->plans->amend($plan, $data, $request->user())]);
    }

    // ── Engagements ──────────────────────────────────────────────────────────

    public function engagementsIndex(Request $request): JsonResponse
    {
        return response()->json($this->engagements->listEngagements($request->all(), $request->user()));
    }

    public function engagementsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'audit_plan_id' => ['nullable', 'integer'],
            'universe_entity_id' => ['nullable', 'integer'],
            'audit_type' => ['nullable', 'string', 'max:64'],
            'planned_start' => ['nullable', 'date'],
            'planned_end' => ['nullable', 'date'],
            'lead_auditor_id' => ['nullable', 'integer'],
            'auditee_owner_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'objectives' => ['nullable', 'string'],
            'scope' => ['nullable', 'string'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->engagements->createEngagement($data, $request->user())], 201);
    }

    public function engagementsShow(Request $request, AuditEngagement $engagement): JsonResponse
    {
        if ((int) $engagement->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json([
            'data' => $engagement->load(['independenceDeclarations', 'findings', 'plan']),
        ]);
    }

    public function engagementsNotify(Request $request, AuditEngagement $engagement): JsonResponse
    {
        return response()->json(['data' => $this->engagements->notifyEngagement($engagement, $request->user())]);
    }

    public function independenceDeclare(Request $request, AuditEngagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:cleared,recused,blocked'],
            'declaration_text' => ['nullable', 'string'],
            'conflict_notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->engagements->declareIndependence($engagement, $data, $request->user())]);
    }

    public function engagementsFieldwork(Request $request, AuditEngagement $engagement): JsonResponse
    {
        return response()->json(['data' => $this->engagements->startFieldwork($engagement, $request->user())]);
    }

    public function evidenceStore(Request $request, AuditEngagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
            'requested_from_user_id' => ['nullable', 'integer'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->engagements->createEvidenceRequest($engagement, $data, $request->user())], 201);
    }

    public function evidenceRespond(Request $request, AuditEvidenceRequest $evidenceRequest): JsonResponse
    {
        $data = $request->validate([
            'response_text' => ['nullable', 'string'],
            'attachment_path' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->engagements->respondEvidence($evidenceRequest, $data, $request->user())], 201);
    }

    public function workpapersStore(Request $request, AuditEngagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:64'],
            'content' => ['nullable', 'string'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->engagements->createWorkpaper($engagement, $data, $request->user())], 201);
    }

    public function workpapersReview(Request $request, AuditWorkpaper $workpaper): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string']]);

        return response()->json(['data' => $this->engagements->addReviewNote($workpaper, $data['note'], $request->user())], 201);
    }

    public function workpapersFinalise(Request $request, AuditWorkpaper $workpaper): JsonResponse
    {
        return response()->json(['data' => $this->engagements->finaliseWorkpaper($workpaper, $request->user())]);
    }

    public function samplesStore(Request $request, AuditEngagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'method' => ['required', 'string', 'in:random,judgmental,systematic,stratified,full_population'],
            'population_size' => ['nullable', 'integer', 'min:0'],
            'sample_size' => ['nullable', 'integer', 'min:0'],
            'population_description' => ['nullable', 'string'],
            'rationale' => ['nullable', 'string'],
            'source_table' => ['nullable', 'string', 'max:64'],
            'sample_ids' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->engagements->documentSample($engagement, $data, $request->user())], 201);
    }

    public function observationsStore(Request $request, AuditEngagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->engagements->createObservation($engagement, $data, $request->user())], 201);
    }

    public function observationsConvert(Request $request, AuditObservation $observation): JsonResponse
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'criterion' => ['nullable', 'string'],
            'condition_text' => ['nullable', 'string'],
            'cause' => ['nullable', 'string'],
            'effect' => ['nullable', 'string'],
            'recommendation' => ['nullable', 'string'],
            'rating' => ['nullable', 'string'],
            'root_cause_category' => ['nullable', 'string'],
            'detect_repeat' => ['nullable', 'boolean'],
            'repeat_of_finding_id' => ['nullable', 'integer'],
            'linked_risk_id' => ['nullable', 'integer'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->findings->createFromObservation($observation, $data, $request->user())], 201);
    }

    // ── Findings ─────────────────────────────────────────────────────────────

    public function findingsIndex(Request $request): JsonResponse
    {
        return response()->json($this->findings->list($request->all(), $request->user()));
    }

    public function findingsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'engagement_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'criterion' => ['nullable', 'string'],
            'condition_text' => ['nullable', 'string'],
            'cause' => ['nullable', 'string'],
            'effect' => ['nullable', 'string'],
            'recommendation' => ['nullable', 'string'],
            'rating' => ['nullable', 'string'],
            'root_cause_category' => ['nullable', 'string'],
            'detect_repeat' => ['nullable', 'boolean'],
            'repeat_of_finding_id' => ['nullable', 'integer'],
            'linked_risk_id' => ['nullable', 'integer'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->findings->createFinding($data, $request->user())], 201);
    }

    public function findingsShow(Request $request, AuditFinding $finding): JsonResponse
    {
        if ((int) $finding->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json([
            'data' => $finding->load(['managementResponses', 'recommendations', 'correctiveActions.assignment']),
        ]);
    }

    public function findingsUpdate(Request $request, AuditFinding $finding): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'criterion' => ['nullable', 'string'],
            'condition_text' => ['nullable', 'string'],
            'cause' => ['nullable', 'string'],
            'effect' => ['nullable', 'string'],
            'recommendation' => ['nullable', 'string'],
            'rating' => ['nullable', 'string'],
            'root_cause_category' => ['nullable', 'string'],
            'linked_risk_id' => ['nullable', 'integer'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->findings->updateDraft($finding, $data, $request->user())]);
    }

    public function findingsIssue(Request $request, AuditFinding $finding): JsonResponse
    {
        return response()->json(['data' => $this->findings->issue($finding, $request->user())]);
    }

    public function findingsRespond(Request $request, AuditFinding $finding): JsonResponse
    {
        $data = $request->validate([
            'response_text' => ['required', 'string'],
            'agrees' => ['nullable', 'boolean'],
            'disagreement_notes' => ['nullable', 'string'],
            'criterion' => ['prohibited'],
            'condition_text' => ['prohibited'],
            'title' => ['prohibited'],
        ]);

        return response()->json(['data' => $this->findings->addManagementResponse($finding, $data, $request->user())], 201);
    }

    public function findingsRecommend(Request $request, AuditFinding $finding): JsonResponse
    {
        $data = $request->validate(['recommendation_text' => ['required', 'string']]);

        return response()->json(['data' => $this->findings->addRecommendation($finding, $data['recommendation_text'], $request->user())], 201);
    }

    public function correctiveStore(Request $request, AuditFinding $finding): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'owner_user_id' => ['nullable', 'integer'],
            'due_date' => ['nullable', 'date'],
            'recommendation_id' => ['nullable', 'integer'],
            'implement_now' => ['nullable', 'boolean'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->findings->createCorrectiveAction($finding, $data, $request->user())], 201);
    }

    public function correctiveComplete(Request $request, AuditCorrectiveAction $correctiveAction): JsonResponse
    {
        return response()->json(['data' => $this->findings->markCorrectiveComplete($correctiveAction, $request->user())]);
    }

    public function correctiveVerify(Request $request, AuditCorrectiveAction $correctiveAction): JsonResponse
    {
        $data = $request->validate([
            'outcome' => ['required', 'string', 'in:verified_closed,reopened,insufficient'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->findings->verify($correctiveAction, $data, $request->user())], 201);
    }

    public function findingsLinkRisk(Request $request, AuditFinding $finding): JsonResponse
    {
        $data = $request->validate(['risk_id' => ['required', 'integer']]);

        return response()->json(['data' => $this->findings->linkRisk($finding, (int) $data['risk_id'], $request->user())]);
    }

    public function findingsRiskAcceptance(Request $request, AuditFinding $finding): JsonResponse
    {
        return response()->json(['data' => $this->findings->markRiskAcceptancePath($finding, $request->user())]);
    }

    // ── Reports ──────────────────────────────────────────────────────────────

    public function reportsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'engagement_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->reports->createDraft($data, $request->user())], 201);
    }

    public function reportsUpdate(Request $request, AuditReport $report): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->reports->updateDraft($report, $data, $request->user())]);
    }

    public function reportsIssue(Request $request, AuditReport $report): JsonResponse
    {
        return response()->json(['data' => $this->reports->issueFinal($report, $request->user())]);
    }

    public function reportsDistribute(Request $request, AuditReport $report): JsonResponse
    {
        $data = $request->validate([
            'recipient_user_id' => ['nullable', 'integer'],
            'recipient_email' => ['nullable', 'email'],
            'recipient_name' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->reports->distribute($report, $data, $request->user())], 201);
    }

    // ── External ─────────────────────────────────────────────────────────────

    public function externalIndex(Request $request): JsonResponse
    {
        return response()->json($this->external->list($request->all(), $request->user()));
    }

    public function externalStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'auditor_firm' => ['nullable', 'string', 'max:255'],
            'access_starts_at' => ['nullable', 'date'],
            'access_ends_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'coordinator_id' => ['nullable', 'integer'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential,secret'],
        ]);

        return response()->json(['data' => $this->external->create($data, $request->user())], 201);
    }

    public function externalActivate(Request $request, AuditExternalEngagement $external): JsonResponse
    {
        return response()->json(['data' => $this->external->activateAccess($external, $request->user())]);
    }

    public function externalRevoke(Request $request, AuditExternalEngagement $external): JsonResponse
    {
        return response()->json(['data' => $this->external->revokeAccess($external, $request->user())]);
    }

    public function externalRequest(Request $request, AuditExternalEngagement $external): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_date' => ['nullable', 'date'],
        ]);

        return response()->json(['data' => $this->external->addRequest($external, $data, $request->user())], 201);
    }

    public function externalFinding(Request $request, AuditExternalEngagement $external): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'linked_finding_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $this->external->addFinding($external, $data, $request->user())], 201);
    }
}
