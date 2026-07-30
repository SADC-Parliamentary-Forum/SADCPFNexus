<?php

namespace App\Http\Controllers\Api\V1\WorkflowEngine;

use App\Http\Controllers\Controller;
use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\WorkflowEngine\WorkflowCertificate;
use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use App\Models\WorkflowEngine\WorkflowTask;
use App\Modules\WorkflowEngine\Services\DefinitionVersionService;
use App\Modules\WorkflowEngine\Services\ReleaseOrchestrator;
use App\Modules\WorkflowEngine\Services\WorkflowOrchestrator;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkflowEngineController extends Controller
{
    public function __construct(
        private readonly WorkflowService $workflows,
        private readonly WorkflowOrchestrator $orchestrator,
        private readonly DefinitionVersionService $definitions,
        private readonly ReleaseOrchestrator $releases,
    ) {}

    public function definitions(Request $request): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.manage-definitions', 'workflows.view-all', 'workflows.admin');

        $rows = ApprovalWorkflow::with(['steps.role', 'steps.user', 'versions'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('module_type')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function createVersion(Request $request, ApprovalWorkflow $workflow): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.manage-definitions', 'workflows.admin');
        abort_unless((int) $workflow->tenant_id === (int) $request->user()->tenant_id, 404);

        $version = $this->definitions->createVersion($workflow, $request->user(), $request->all());

        return response()->json(['data' => $version], 201);
    }

    public function validateVersion(Request $request, WorkflowDefinitionVersion $version): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.manage-definitions', 'workflows.admin');
        $errors = $this->definitions->validate($version);

        return response()->json(['valid' => $errors === [], 'errors' => $errors]);
    }

    public function approveVersion(Request $request, WorkflowDefinitionVersion $version): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.approve-definitions', 'workflows.admin');

        return response()->json(['data' => $this->definitions->approve($version, $request->user())]);
    }

    public function publishVersion(Request $request, WorkflowDefinitionVersion $version): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.publish-definitions', 'workflows.admin');

        return response()->json(['data' => $this->definitions->publish($version, $request->user())]);
    }

    public function retireVersion(Request $request, WorkflowDefinitionVersion $version): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.publish-definitions', 'workflows.admin');

        return response()->json(['data' => $this->definitions->retire($version, $request->user())]);
    }

    public function start(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', 'string'],
            'subject_id' => ['required', 'integer'],
            'module_type' => ['required', 'string'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
            'condition_context' => ['nullable', 'array'],
        ]);

        $this->authorizePermission($request, 'workflows.submit', 'workflows.act', 'workflows.admin');

        $class = $data['subject_type'];
        abort_unless(class_exists($class), 422, 'Unknown subject type');
        $entity = $class::findOrFail($data['subject_id']);

        $approval = $this->workflows->initiate(
            $entity,
            $data['module_type'],
            $request->user(),
            $data['idempotency_key'] ?? null,
            $data['condition_context'] ?? []
        );

        return response()->json(['data' => $approval], $approval ? 201 : 422);
    }

    public function show(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);
        $snapshot = $this->workflows->snapshot($approvalRequest);

        return response()->json([
            'data' => array_merge($approvalRequest->load(['workflow.steps', 'tasks', 'packages'])->toArray(), [
                'tracker' => $snapshot,
            ]),
        ]);
    }

    public function timeline(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $this->workflows->snapshot($approvalRequest)]);
    }

    public function inbox(Request $request): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.act', 'workflows.view-own', 'workflows.approve', 'workflows.admin');
        $tasks = $this->orchestrator->inbox($request->user(), [
            'status' => $request->query('status', 'awaiting'),
            'module' => $request->query('module'),
        ]);

        return response()->json(['data' => $tasks]);
    }

    public function decide(Request $request, WorkflowTask $task): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.act', 'workflows.approve', 'workflows.recommend', 'workflows.certify', 'workflows.authorise', 'workflows.sign', 'workflows.admin');
        abort_unless((int) $task->tenant_id === (int) $request->user()->tenant_id, 404);
        abort_unless((int) $task->assigned_user_id === (int) $request->user()->id || $request->user()->isSystemAdmin(), 403);

        $data = $request->validate([
            'decision_type' => ['required', 'string', 'in:approve,reject,return,recommend,certify,authorise,sign,verify,acknowledge'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $approval = ApprovalRequest::findOrFail($task->approval_request_id);

        if ($data['decision_type'] === 'reject') {
            $this->workflows->reject($approval, $request->user(), $data['comment'] ?? 'Rejected', $data['idempotency_key'] ?? null);
            $result = ['completed' => true];
        } elseif ($data['decision_type'] === 'return') {
            $result = $this->workflows->returnForCorrection($approval, $request->user(), $data['comment'] ?? 'Returned');
        } else {
            $result = $this->workflows->approve($approval, $request->user(), $data['comment'] ?? null, $data['idempotency_key'] ?? null);
            if ($data['decision_type'] === 'sign') {
                $this->lockPackageDocumentVersions($request->user(), $approval);
            }
        }

        return response()->json(['data' => $result]);
    }

    /**
     * Workflow signature stage — lock Document Service versions referenced in the approval package.
     */
    private function lockPackageDocumentVersions(\App\Models\User $actor, ApprovalRequest $approval): void
    {
        $package = \App\Models\WorkflowEngine\WorkflowApprovalPackage::query()
            ->where('approval_request_id', $approval->id)
            ->orderByDesc('package_version')
            ->first();
        if (! $package) {
            return;
        }

        $docs = $package->document_snapshot ?? [];
        $storage = app(\App\Modules\Documents\Services\DocumentStorageService::class);
        foreach ($docs as $doc) {
            $versionId = $doc['document_version_id'] ?? null;
            if (! $versionId) {
                continue;
            }
            try {
                $version = $storage->findVersionForTenant((int) $actor->tenant_id, (int) $versionId);
                $storage->lockAfterSignature($actor, $version, [
                    'approval_request_id' => $approval->id,
                    'source' => 'workflow_sign_stage',
                ]);
            } catch (\Throwable) {
                // Non-managed attachments without Document Service versions are skipped.
            }
        }
    }

    public function withdraw(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.withdraw', 'workflows.act', 'workflows.admin');
        $this->workflows->withdraw($approvalRequest, $request->user());

        return response()->json(['message' => 'Withdrawn.']);
    }

    public function cancel(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.cancel', 'workflows.admin');
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);

        $approvalRequest->update([
            'status' => 'cancelled',
            'completed_at' => now(),
            'current_holder_ids' => [],
        ]);

        return response()->json(['message' => 'Cancelled.']);
    }

    public function certificate(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        abort_unless((int) $approvalRequest->tenant_id === (int) $request->user()->tenant_id, 404);
        $cert = WorkflowCertificate::where('approval_request_id', $approvalRequest->id)->first()
            ?? $this->releases->issueCertificate($approvalRequest);

        return response()->json(['data' => $cert]);
    }

    public function retryRelease(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $this->authorizePermission($request, 'workflows.resolve-exception', 'workflows.admin');
        $count = $this->releases->retryDue();

        return response()->json(['retried' => $count]);
    }

    private function authorizePermission(Request $request, string ...$anyOf): void
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
        // Soft-allow during bootstrap when permissions not yet seeded onto role
        if ($user->can('roles.manage') || $user->can('pif.approve') || $user->can('leave.approve') || $user->can('travel.approve')) {
            return;
        }
        abort(403, 'Missing workflow permission.');
    }
}
