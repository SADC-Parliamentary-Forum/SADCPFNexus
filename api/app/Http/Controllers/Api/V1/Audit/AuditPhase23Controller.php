<?php

namespace App\Http\Controllers\Api\V1\Audit;

use App\Http\Controllers\Controller;
use App\Models\AuditAiSuggestion;
use App\Models\AuditEngagement;
use App\Models\AuditExternalAppointment;
use App\Models\AuditExternalEngagement;
use App\Models\AuditSample;
use App\Modules\Audit\Services\AuditAiAssistService;
use App\Modules\Audit\Services\AuditAnalyticsService;
use App\Modules\Audit\Services\AuditExternalService;
use App\Modules\Audit\Services\AuditPhase2Service;
use App\Modules\Audit\Services\AuditSampleExtractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditPhase23Controller extends Controller
{
    public function __construct(
        private readonly AuditAnalyticsService $analytics,
        private readonly AuditSampleExtractionService $samples,
        private readonly AuditPhase2Service $phase2,
        private readonly AuditExternalService $external,
        private readonly AuditAiAssistService $ai,
    ) {}

    public function analytics(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->analytics->metrics($request->user())]);
    }

    public function extractSample(Request $request, AuditEngagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'source_module' => ['nullable', 'string', 'in:procurement,travel,assets,stock,payroll,manual'],
            'method' => ['required', 'string', 'in:random,judgmental,systematic,stratified,full_population'],
            'sample_size' => ['nullable', 'integer', 'min:1'],
            'population_ids' => ['nullable', 'array'],
            'population_ids.*' => ['integer'],
            'population_description' => ['nullable', 'string'],
            'rationale' => ['nullable', 'string'],
            'source_table' => ['nullable', 'string', 'max:64'],
        ]);

        return response()->json(['data' => $this->samples->extractAndFreeze($engagement, $data, $request->user())], 201);
    }

    public function adjustSample(Request $request, AuditSample $sample): JsonResponse
    {
        $data = $request->validate([
            'sample_ids' => ['required', 'array', 'min:1'],
            'sample_ids.*' => ['integer'],
            'justification' => ['required', 'string', 'min:3'],
        ]);

        return response()->json(['data' => $this->samples->adjust($sample, $data, $request->user())]);
    }

    public function listCampaigns(Request $request): JsonResponse
    {
        return response()->json($this->phase2->listCampaigns($request->all(), $request->user()));
    }

    public function storeCampaign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'risk_campaign_id' => ['nullable', 'integer'],
            'engagement_id' => ['nullable', 'integer'],
            'universe_entity_id' => ['nullable', 'integer'],
            'scheduled_start' => ['nullable', 'date'],
            'scheduled_end' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.control_title' => ['required_with:items', 'string', 'max:255'],
            'items.*.control_ref' => ['nullable', 'string', 'max:64'],
            'items.*.finding_id' => ['nullable', 'integer'],
            'items.*.due_date' => ['nullable', 'date'],
        ]);

        return response()->json(['data' => $this->phase2->createCampaign($data, $request->user())], 201);
    }

    public function storeEffortBudget(Request $request): JsonResponse
    {
        $data = $request->validate([
            'audit_plan_id' => ['nullable', 'integer'],
            'engagement_id' => ['nullable', 'integer'],
            'auditor_user_id' => ['nullable', 'integer'],
            'budget_hours' => ['required', 'numeric', 'min:0'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['data' => $this->phase2->createEffortBudget($data, $request->user())], 201);
    }

    public function storeEffortEntry(Request $request): JsonResponse
    {
        $data = $request->validate([
            'effort_budget_id' => ['nullable', 'integer'],
            'engagement_id' => ['nullable', 'integer'],
            'auditor_user_id' => ['nullable', 'integer'],
            'work_date' => ['required', 'date'],
            'hours' => ['required', 'numeric', 'min:0.25'],
            'activity' => ['nullable', 'string', 'max:128'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->phase2->logEffort($data, $request->user())], 201);
    }

    public function capacity(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->phase2->capacityView($request->user())]);
    }

    public function listQa(Request $request): JsonResponse
    {
        return response()->json($this->phase2->listQaReviews($request->all(), $request->user()));
    }

    public function storeQa(Request $request): JsonResponse
    {
        $data = $request->validate([
            'engagement_id' => ['nullable', 'integer'],
            'workpaper_id' => ['nullable', 'integer'],
            'reviewer_id' => ['nullable', 'integer'],
            'review_type' => ['nullable', 'string', 'in:engagement_qa,workpaper_qa,peer'],
            'outcome' => ['nullable', 'string', 'in:pending,satisfactory,needs_improvement,unsatisfactory'],
            'findings_summary' => ['nullable', 'string'],
            'recommendations' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->phase2->createQaReview($data, $request->user())], 201);
    }

    public function listTemplates(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->phase2->listTemplates($request->user())]);
    }

    public function applyTemplate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'engagement_id' => ['required', 'integer'],
            'donor_template_id' => ['required', 'integer'],
            'report_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->phase2->applyTemplate(
                (int) $data['engagement_id'],
                (int) $data['donor_template_id'],
                $request->user(),
                $data['report_id'] ?? null
            ),
        ], 201);
    }

    public function storeGovernancePack(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'fiscal_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'audience' => ['nullable', 'string', 'max:64'],
            'format' => ['nullable', 'string', 'in:structured_json,pdf_manifest,zip_manifest'],
        ]);

        return response()->json(['data' => $this->phase2->createGovernancePack($data, $request->user())], 201);
    }

    public function listAppointments(Request $request): JsonResponse
    {
        return response()->json($this->external->listAppointments($request->all(), $request->user()));
    }

    public function storeAppointment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'firm_name' => ['required', 'string', 'max:255'],
            'plenary_resolution_ref' => ['nullable', 'string', 'max:255'],
            'appointed_on' => ['nullable', 'date'],
            'term_starts_on' => ['nullable', 'date'],
            'term_ends_on' => ['nullable', 'date'],
            'independence_docs_on_file' => ['nullable', 'boolean'],
            'independence_doc_path' => ['nullable', 'string', 'max:512'],
            'procurement_tender_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->external->createAppointment($data, $request->user())], 201);
    }

    public function renewAppointment(Request $request, AuditExternalAppointment $appointment): JsonResponse
    {
        $data = $request->validate([
            'renewed_on' => ['required', 'date'],
            'term_starts_on' => ['nullable', 'date'],
            'term_ends_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->external->recordRenewal($appointment, $data, $request->user())], 201);
    }

    public function autoRevokeCheck(Request $request, AuditExternalEngagement $external): JsonResponse
    {
        return response()->json(['data' => $this->external->autoRevokeIfNeeded($external, $request->user())]);
    }

    public function evidenceDownload(Request $request, AuditExternalEngagement $external): JsonResponse
    {
        $data = $request->validate([
            'document_label' => ['required', 'string', 'max:255'],
            'document_path' => ['nullable', 'string', 'max:512'],
        ]);

        return response()->json(['data' => $this->external->logEvidenceDownload($external, $data, $request->user())], 201);
    }

    public function aiSuggest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'string', 'max:64'],
            'engagement_id' => ['nullable', 'integer'],
            'context' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->ai->suggest($data, $request->user())], 201);
    }

    public function aiApply(Request $request, AuditAiSuggestion $suggestion): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'string', 'max:64'],
            'confirmed' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->ai->apply($suggestion, $data, $request->user())]);
    }
}
