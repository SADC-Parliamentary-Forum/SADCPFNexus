<?php

namespace App\Http\Controllers\Api\V1\PeopleAuthority;

use App\Http\Controllers\Controller;
use App\Models\PeopleAuthority\DocumentSignatureEvent;
use App\Models\PeopleAuthority\EmploymentRecord;
use App\Models\PeopleAuthority\PeopleAiSuggestion;
use App\Models\PeopleAuthority\PeopleEsignRequest;
use App\Models\PeopleAuthority\PeoplePrivilegeAlert;
use App\Modules\PeopleAuthority\Services\PeopleAiAssistService;
use App\Modules\PeopleAuthority\Services\PeoplePhase2Service;
use App\Modules\PeopleAuthority\Services\PeoplePhase3Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PeopleAuthorityPhase23Controller extends Controller
{
    public function __construct(
        private readonly PeoplePhase2Service $phase2,
        private readonly PeoplePhase3Service $phase3,
        private readonly PeopleAiAssistService $ai,
    ) {}

    // ── Phase 2 ──────────────────────────────────────────────────────────────

    public function enrolCertificate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'person_id' => ['required', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'certificate_pem' => ['nullable', 'string'],
            'thumbprint' => ['nullable', 'string', 'max:128'],
            'subject' => ['nullable', 'string', 'max:255'],
            'expires_at' => ['nullable', 'date'],
        ]);

        return response()->json(['data' => $this->phase2->enrolCertificate($request->user(), $data)], 201);
    }

    public function listEsign(Request $request): JsonResponse
    {
        return response()->json($this->phase2->listEsignRequests($request->user()));
    }

    public function storeEsign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'document_type' => ['required', 'string', 'max:128'],
            'document_id' => ['required'],
            'document_version_id' => ['nullable', 'string', 'max:128'],
            'document_hash' => ['required', 'string', 'max:128'],
            'recipients' => ['nullable', 'array'],
            'payload' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->phase2->createEsignRequest($request->user(), $data)], 201);
    }

    public function submitEsign(Request $request, PeopleEsignRequest $esignRequest): JsonResponse
    {
        return response()->json(['data' => $this->phase2->submitEsignRequest($request->user(), $esignRequest)]);
    }

    public function listDirectorySync(Request $request): JsonResponse
    {
        return response()->json($this->phase2->listDirectorySyncRuns($request->user()));
    }

    public function runDirectorySync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'driver' => ['nullable', 'string', 'in:null,fixture,microsoft_graph'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->phase2->runDirectorySync($request->user(), $data)], 201);
    }

    public function openRecertification(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'recurrence' => ['nullable', 'string', 'max:32'],
            'auto_populate_roles' => ['nullable', 'boolean'],
            'due_date' => ['nullable', 'date'],
        ]);

        return response()->json(['data' => $this->phase2->openRecertificationCampaign($request->user(), $data)], 201);
    }

    public function analyseSod(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['data' => $this->phase2->analyseSod($request->user(), $data)], 201);
    }

    public function listSodReports(Request $request): JsonResponse
    {
        return response()->json($this->phase2->listSodReports($request->user()));
    }

    public function listOrgScenarios(Request $request): JsonResponse
    {
        return response()->json($this->phase2->listOrgScenarios($request->user()));
    }

    public function storeOrgScenario(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'structure' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->phase2->createOrgScenario($request->user(), $data)], 201);
    }

    public function linkPayroll(Request $request, EmploymentRecord $employment): JsonResponse
    {
        $data = $request->validate([
            'payroll_identifier' => ['required', 'string', 'max:128'],
            'payroll_export_status' => ['nullable', 'string', 'max:32'],
        ]);

        return response()->json(['data' => $this->phase2->linkPayrollIdentifier($request->user(), $employment, $data)]);
    }

    public function exportPayrollLinks(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->phase2->exportPayrollLinks($request->user())]);
    }

    public function publishSignatureVerify(Request $request, DocumentSignatureEvent $signature): JsonResponse
    {
        return response()->json(['data' => $this->phase2->publishSignatureVerification($request->user(), $signature)]);
    }

    public function publicVerify(string $token): JsonResponse
    {
        return response()->json(['data' => $this->phase2->publicVerify($token)]);
    }

    // ── Phase 3 ──────────────────────────────────────────────────────────────

    public function listSuccession(Request $request): JsonResponse
    {
        return response()->json($this->phase3->listSuccessionPlans($request->user()));
    }

    public function storeSuccession(Request $request): JsonResponse
    {
        $data = $request->validate([
            'position_id' => ['required', 'integer'],
            'title' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string'],
            'candidates' => ['nullable', 'array'],
            'candidates.*.person_id' => ['required_with:candidates', 'integer'],
            'candidates.*.readiness' => ['nullable', 'string', 'in:ready,developing,long_term'],
            'candidates.*.rank' => ['nullable', 'integer', 'min:1', 'max:99'],
            'candidates.*.notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->phase3->createSuccessionPlan($request->user(), $data)], 201);
    }

    public function listSkills(Request $request): JsonResponse
    {
        return response()->json($this->phase3->listSkills($request->user()));
    }

    public function storeSkill(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->phase3->createSkill($request->user(), $data)], 201);
    }

    public function assignSkill(Request $request): JsonResponse
    {
        $data = $request->validate([
            'person_id' => ['required', 'integer'],
            'skill_id' => ['required', 'integer'],
            'level' => ['nullable', 'string', 'in:awareness,working,proficient,expert'],
            'assessed_on' => ['nullable', 'date'],
            'evidence_notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->phase3->assignPersonSkill($request->user(), $data)], 201);
    }

    public function personSkills(Request $request, int $person): JsonResponse
    {
        return response()->json(['data' => $this->phase3->listPersonSkills($request->user(), $person)]);
    }

    public function detectAnomalies(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->phase3->detectAnomalousPrivileges($request->user())], 201);
    }

    public function listPrivilegeAlerts(Request $request): JsonResponse
    {
        return response()->json($this->phase3->listPrivilegeAlerts($request->user()));
    }

    public function acknowledgePrivilegeAlert(Request $request, PeoplePrivilegeAlert $alert): JsonResponse
    {
        return response()->json(['data' => $this->phase3->acknowledgePrivilegeAlert($request->user(), $alert)]);
    }

    public function nlSearch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:255'],
        ]);

        return response()->json(['data' => $this->phase3->nlOrgSearch($request->user(), $data['q'])]);
    }

    public function analytics(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->phase3->analytics($request->user())]);
    }

    public function aiSuggest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', 'string', 'max:64'],
            'context' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->ai->suggest($data, $request->user())], 201);
    }

    public function aiApply(Request $request, PeopleAiSuggestion $suggestion): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'string', 'max:64'],
            'confirmed' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->ai->apply($suggestion, $data, $request->user())]);
    }
}
