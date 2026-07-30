<?php

namespace App\Http\Controllers\Api\V1\WorkflowEngine;

use App\Http\Controllers\Controller;
use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\WorkflowEngine\WorkflowAiSuggestion;
use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use App\Models\WorkflowEngine\WorkflowTask;
use App\Models\WorkflowEngine\WorkflowWorkingCalendar;
use App\Modules\WorkflowEngine\Services\DefinitionVersionService;
use App\Modules\WorkflowEngine\Services\GovernanceExternalService;
use App\Modules\WorkflowEngine\Services\WorkflowAiAssistService;
use App\Modules\WorkflowEngine\Services\WorkflowAnalyticsService;
use App\Modules\WorkflowEngine\Services\WorkflowOrchestrator;
use App\Modules\WorkflowEngine\Services\WorkflowSimulationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Workflow Engine Phase 2 + Phase 3 endpoints (PRD §122–§123).
 */
class WorkflowEnginePhase23Controller extends Controller
{
    public function __construct(
        private readonly DefinitionVersionService $definitions,
        private readonly WorkflowSimulationService $simulator,
        private readonly WorkflowAnalyticsService $analytics,
        private readonly GovernanceExternalService $governance,
        private readonly WorkflowAiAssistService $ai,
        private readonly WorkflowOrchestrator $orchestrator,
    ) {}

    public function lint(Request $request, WorkflowDefinitionVersion $version): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.manage-definitions', 'workflows.design', 'workflows.admin');

        return response()->json(['data' => $this->definitions->lint($version)]);
    }

    public function updateDraft(Request $request, WorkflowDefinitionVersion $version): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.design', 'workflows.manage-definitions', 'workflows.admin');
        $data = $request->validate([
            'stages' => ['nullable', 'array'],
            'transitions' => ['nullable', 'array'],
            'conditions' => ['nullable', 'array'],
            'policy_reference' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['data' => $this->definitions->updateDraft($version, $data, $request->user())]);
    }

    public function simulate(Request $request, ApprovalWorkflow $workflow): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.simulate', 'workflows.manage-definitions', 'workflows.admin');
        abort_unless((int) $workflow->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'test_context' => ['nullable', 'array'],
            'definition_version_id' => ['nullable', 'integer'],
        ]);

        $version = null;
        if (! empty($data['definition_version_id'])) {
            $version = WorkflowDefinitionVersion::findOrFail($data['definition_version_id']);
        }

        $sim = $this->simulator->simulate($workflow, $request->user(), $data['test_context'] ?? [], $version);

        return response()->json([
            'data' => $sim,
            'created_production_approval' => false,
        ], 201);
    }

    public function analytics(Request $request): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.analytics', 'workflows.view-all', 'workflows.admin');

        return response()->json([
            'data' => $this->analytics->summary((int) $request->user()->tenant_id, [
                'since' => $request->query('since'),
            ]),
        ]);
    }

    public function recordGovernance(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.governance-record', 'workflows.act', 'workflows.admin');
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'body_name' => ['required', 'string', 'max:255'],
            'meeting_reference' => ['nullable', 'string', 'max:255'],
            'resolution_reference' => ['nullable', 'string', 'max:255'],
            'members_present' => ['nullable', 'integer', 'min:0'],
            'quorum_required' => ['nullable', 'integer', 'min:0'],
            'quorum_met' => ['required', 'boolean'],
            'decision' => ['required', 'string', 'in:approved,rejected,deferred,noted'],
            'voting_result' => ['nullable', 'array'],
            'recorder_role' => ['nullable', 'string', 'in:secretary,chair,certifier,recorder'],
            'chair_user_id' => ['nullable', 'integer'],
            'minutes_evidence_path' => ['nullable', 'string', 'max:500'],
            'decision_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'step_index' => ['nullable', 'integer'],
            'advance' => ['nullable', 'boolean'],
        ]);

        $row = $this->governance->recordGovernance($approvalRequest, $request->user(), $data);

        return response()->json([
            'data' => $row,
            'decision_authority' => $row->decisionAuthority(),
            'recorded_by' => $request->user()->name,
        ], 201);
    }

    public function recordExternal(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.external-approve', 'workflows.act', 'workflows.admin');
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'external_body' => ['nullable', 'string', 'max:255'],
            'external_person' => ['nullable', 'string', 'max:255'],
            'decision_date' => ['required', 'date'],
            'decision' => ['required', 'string', 'in:approved,rejected,noted'],
            'evidence_reference' => ['nullable', 'string', 'max:255'],
            'evidence_path' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string'],
            'step_index' => ['nullable', 'integer'],
            'advance' => ['nullable', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->governance->recordExternal($approvalRequest, $request->user(), $data),
        ], 201);
    }

    public function pauseSla(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.act', 'workflows.admin');
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $this->orchestrator->pauseSla($approvalRequest, $request->user())]);
    }

    public function resumeSla(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.act', 'workflows.admin');
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $this->orchestrator->resumeSla($approvalRequest, $request->user())]);
    }

    public function claimTask(Request $request, WorkflowTask $task): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.act', 'workflows.approve', 'workflows.admin');
        abort_unless((int) $task->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $this->orchestrator->claimQueueTask($task, $request->user())]);
    }

    public function calendars(Request $request): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.calendars.manage', 'workflows.manage-definitions', 'workflows.admin');
        $rows = WorkflowWorkingCalendar::where('tenant_id', $request->user()->tenant_id)->orderBy('code')->get();

        return response()->json(['data' => $rows]);
    }

    public function storeCalendar(Request $request): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.calendars.manage', 'workflows.admin');
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'working_days' => ['nullable', 'array'],
            'day_start' => ['nullable', 'string'],
            'day_end' => ['nullable', 'string'],
            'holidays' => ['nullable', 'array'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'is_default' => ['nullable', 'boolean'],
        ]);
        $data['tenant_id'] = $request->user()->tenant_id;
        $row = WorkflowWorkingCalendar::updateOrCreate(
            ['tenant_id' => $data['tenant_id'], 'code' => $data['code']],
            $data
        );

        return response()->json(['data' => $row], 201);
    }

    public function aiSuggest(Request $request): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.ai.suggest', 'workflows.admin');
        $data = $request->validate([
            'kind' => ['required', 'string'],
            'context' => ['nullable', 'array'],
            'definition_version_id' => ['nullable', 'integer'],
            'workflow_definition_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $this->ai->suggest($data, $request->user())], 201);
    }

    public function aiApply(Request $request, WorkflowAiSuggestion $suggestion): JsonResponse
    {
        $this->authorizeAny($request, 'workflows.ai.apply', 'workflows.admin');
        $data = $request->validate([
            'action' => ['required', 'string'],
            'confirmed' => ['required', 'boolean'],
            'note' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->ai->apply($suggestion, $data, $request->user())]);
    }

    public function aiGuards(): JsonResponse
    {
        return response()->json([
            'data' => [
                'can_auto_publish' => $this->ai->canAutoPublish(),
                'can_auto_approve' => $this->ai->canAutoApprove(),
                'can_auto_grant_authority' => $this->ai->canAutoGrantAuthority(),
                'can_auto_skip_stage' => $this->ai->canAutoSkipStage(),
                'can_auto_resolve_sod' => $this->ai->canAutoResolveSod(),
                'can_auto_apply_signature' => $this->ai->canAutoApplySignature(),
                'can_auto_accept_exception' => $this->ai->canAutoAcceptException(),
            ],
        ]);
    }

    private function authorizeAny(Request $request, string ...$anyOf): void
    {
        $user = $request->user();
        if ($user->isSystemAdmin()) {
            return;
        }
        foreach ($anyOf as $perm) {
            if ($user->can($perm)) {
                return;
            }
        }
        if ($user->can('roles.manage') || $user->can('workflows.manage-definitions')) {
            return;
        }
        abort(403, 'Missing workflow permission.');
    }
}
