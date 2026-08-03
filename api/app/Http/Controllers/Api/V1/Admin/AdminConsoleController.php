<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\AdminConsole\Services\AdminConsoleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminConsoleController extends Controller
{
    public function __construct(private readonly AdminConsoleService $service) {}

    public function dashboard(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view']);

        return response()->json(['data' => $this->service->dashboard($this->tenantId($request))]);
    }

    public function platformStatus(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-health']);

        return response()->json(['data' => $this->service->platformStatus($this->tenantId($request))]);
    }

    public function modules(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-modules']);

        return response()->json(['data' => $this->service->modules($this->tenantId($request))]);
    }

    public function showModule(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-modules']);

        return response()->json(['data' => $this->service->module($this->tenantId($request), $id)]);
    }

    public function changeModuleStatus(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-modules']);
        $data = $request->validate([
            'status' => 'required|string|in:planned,in_development,testing,pilot,active,degraded,temporarily_disabled,read_only,deprecated,retired,archived',
            'availability' => 'nullable|string|in:operational,degraded,partial_outage,major_outage,maintenance,recovery_in_progress,unknown',
            'health_status' => 'nullable|string|in:operational,degraded,failing,disabled,maintenance,unknown',
            'reason' => 'nullable|string|max:2000',
        ]);

        return response()->json(['data' => $this->service->changeModuleStatus($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function configurations(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-config']);

        return response()->json(['data' => $this->service->configurations($this->tenantId($request))]);
    }

    public function proposeConfigurationChange(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.propose-config']);
        $data = $request->validate([
            'proposed_value' => 'required',
            'reason' => 'required|string|max:2000',
            'business_justification' => 'nullable|string|max:4000',
            'risk_assessment' => 'nullable|string|max:80',
            'affected_modules' => 'nullable|array',
            'affected_users' => 'nullable|array',
            'effective_from' => 'nullable|date',
            'testing_evidence' => 'nullable|string|max:4000',
            'rollback_plan' => 'nullable|string|max:4000',
        ]);

        return response()->json(['data' => $this->service->proposeConfigurationChange($this->tenantId($request), $id, $data, $request->user())], 201);
    }

    public function validateConfigurationChange(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.review-config']);

        return response()->json(['data' => $this->service->validateConfigurationChange($this->tenantId($request), $id, $request->user())]);
    }

    public function reviewConfigurationChange(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.review-config']);
        $data = $request->validate([
            'review_type' => 'required|string|in:technical,business,security',
            'decision' => 'required|string|in:approve,reject,request_changes',
            'notes' => 'nullable|string|max:4000',
        ]);

        return response()->json(['data' => $this->service->reviewConfigurationChange($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function approveConfigurationChange(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.approve-config']);

        return response()->json(['data' => $this->service->approveConfigurationChange($this->tenantId($request), $id, $request->user())]);
    }

    public function scheduleConfigurationChange(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.activate-config']);
        $data = $request->validate([
            'effective_from' => 'required|date',
        ]);

        return response()->json(['data' => $this->service->scheduleConfigurationChange($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function activateConfigurationChange(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.activate-config']);

        return response()->json(['data' => $this->service->activateConfigurationChange($this->tenantId($request), $id, $request->user())]);
    }

    public function rollbackConfigurationChange(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.rollback-config']);
        $data = $request->validate([
            'rollback_version_id' => 'nullable|integer',
            'reason' => 'required|string|max:2000',
        ]);
        $data['rollback_version_id'] = $data['rollback_version_id'] ?? null;

        return response()->json(['data' => $this->service->rollbackConfigurationChange($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function referenceData(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-reference-data']);

        return response()->json(['data' => $this->service->referenceData($this->tenantId($request))]);
    }

    public function storeReferenceItem(Request $request, int $set): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-reference-data']);
        $data = $request->validate([
            'code' => 'required|string|max:100',
            'label_en' => 'required|string|max:255',
            'label_fr' => 'nullable|string|max:255',
            'label_pt' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:2000',
            'sequence' => 'nullable|integer|min:0',
            'effective_from' => 'nullable|date',
            'metadata' => 'nullable|array',
        ]);

        return response()->json(['data' => $this->service->addReferenceItem($this->tenantId($request), $set, $data, $request->user())], 201);
    }

    public function updateReferenceItem(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-reference-data']);
        $data = $request->validate([
            'label_en' => 'nullable|string|max:255',
            'label_fr' => 'nullable|string|max:255',
            'label_pt' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:2000',
            'sequence' => 'nullable|integer|min:0',
            'effective_to' => 'nullable|date',
            'metadata' => 'nullable|array',
        ]);

        return response()->json(['data' => $this->service->updateReferenceItem($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function deprecateReferenceItem(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.approve-reference-data', 'admin-console.manage-reference-data']);
        $data = $request->validate([
            'reason' => 'required|string|max:2000',
            'effective_to' => 'nullable|date',
            'replacement_item_id' => 'nullable|integer',
        ]);

        return response()->json(['data' => $this->service->deprecateReferenceItem($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function importReferenceData(Request $request, int $set): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-reference-data']);
        $data = $request->validate([
            'rows' => 'required|array|min:1|max:500',
            'rows.*.code' => 'required|string|max:100',
            'rows.*.label_en' => 'required|string|max:255',
            'rows.*.label_fr' => 'nullable|string|max:255',
            'rows.*.label_pt' => 'nullable|string|max:255',
            'dry_run' => 'nullable|boolean',
        ]);

        return response()->json(['data' => $this->service->importReferenceData($this->tenantId($request), $set, $data['rows'], $request->boolean('dry_run', true), $request->user())]);
    }

    public function featureFlags(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-feature-flags']);

        return response()->json(['data' => $this->service->featureFlags($this->tenantId($request))]);
    }

    public function calendars(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-calendars']);

        return response()->json(['data' => $this->service->calendars($this->tenantId($request))]);
    }

    public function numberingSchemes(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-numbering']);

        return response()->json(['data' => $this->service->numberingSchemes($this->tenantId($request))]);
    }

    public function localisation(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-localisation']);

        return response()->json(['data' => $this->service->localisation($this->tenantId($request))]);
    }

    public function integrations(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-integrations']);

        return response()->json(['data' => $this->service->integrations($this->tenantId($request))]);
    }

    public function storeFeatureFlag(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-feature-flags']);
        $data = $request->validate([
            'flag_key' => 'required|string|max:120',
            'description' => 'nullable|string|max:2000',
            'owner_id' => 'nullable|integer',
            'flag_type' => 'nullable|string|in:release,operational,experiment,emergency_kill_switch,permission_gated,module,integration',
            'default_enabled' => 'nullable|boolean',
            'environment' => 'nullable|string|max:40',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after_or_equal:start_at',
            'configuration' => 'nullable|array',
            'rollback_plan' => 'nullable|string|max:4000',
            'targets' => 'nullable|array|max:50',
            'targets.*.target_type' => 'required_with:targets|string|max:40',
            'targets.*.target_value' => 'required_with:targets|string|max:120',
            'targets.*.metadata' => 'nullable|array',
        ]);
        $this->assertTenantUser($request, $data['owner_id'] ?? null);

        return response()->json(['data' => $this->service->createFeatureFlag($this->tenantId($request), $data, $request->user())], 201);
    }

    public function approveFeatureFlag(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.approve-feature-flags']);

        return response()->json(['data' => $this->service->approveFeatureFlag($this->tenantId($request), $id, $request->user())]);
    }

    public function activateFeatureFlag(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-feature-flags']);

        return response()->json(['data' => $this->service->activateFeatureFlag($this->tenantId($request), $id, $request->user())]);
    }

    public function disableFeatureFlag(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-feature-flags']);

        return response()->json(['data' => $this->service->disableFeatureFlag($this->tenantId($request), $id, $request->user())]);
    }

    public function jobs(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-jobs']);

        return response()->json(['data' => $this->service->scheduledJobs($this->tenantId($request))]);
    }

    public function jobRuns(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-jobs']);

        return response()->json(['data' => $this->service->jobRuns($this->tenantId($request))]);
    }

    public function runJob(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.run-jobs']);
        $data = $request->validate([
            'reason' => 'required|string|max:2000',
            'scope' => 'nullable|array',
        ]);

        return response()->json(['data' => $this->service->runJob($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function queues(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-jobs']);

        return response()->json(['data' => $this->service->queues($this->tenantId($request))]);
    }

    public function deadLetters(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-dead-letters']);

        return response()->json(['data' => $this->service->deadLetters($this->tenantId($request))]);
    }

    public function replayDeadLetter(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-dead-letters']);

        return response()->json(['data' => $this->service->replayDeadLetter($this->tenantId($request), $id, $request->user())]);
    }

    public function resolveDeadLetter(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-dead-letters']);
        $data = $request->validate([
            'action' => 'nullable|string|in:correct_mapping,mark_duplicate,cancel_with_reason,escalate,create_incident,close_as_accepted_exception',
            'status' => 'nullable|string|max:80',
            'reason' => 'required|string|max:2000',
        ]);

        return response()->json(['data' => $this->service->resolveDeadLetter($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function systemHealth(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-health']);

        return response()->json(['data' => $this->service->systemHealth($this->tenantId($request))]);
    }

    public function createMaintenanceWindow(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-maintenance']);
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'purpose' => 'required|string|max:4000',
            'affected_services' => 'nullable|array',
            'planned_start' => 'required|date',
            'planned_end' => 'required|date|after:planned_start',
            'expected_impact' => 'nullable|string|max:4000',
            'read_only_services' => 'nullable|array',
            'unavailable_services' => 'nullable|array',
            'business_owner_id' => 'nullable|integer',
            'technical_owner_id' => 'nullable|integer',
            'communication_plan' => 'nullable|string|max:4000',
            'rollback_plan' => 'nullable|string|max:4000',
            'maintenance_mode' => 'nullable|string|in:notice_only,read_only,selected_module_disabled,full_platform_maintenance,emergency_lockdown',
        ]);
        $this->assertTenantUser($request, $data['business_owner_id'] ?? null);
        $this->assertTenantUser($request, $data['technical_owner_id'] ?? null);

        return response()->json(['data' => $this->service->createMaintenanceWindow($this->tenantId($request), $data, $request->user())], 201);
    }

    public function approveMaintenanceWindow(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-maintenance']);

        return response()->json(['data' => $this->service->approveMaintenanceWindow($this->tenantId($request), $id, $request->user())]);
    }

    public function startMaintenanceWindow(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-maintenance']);

        return response()->json(['data' => $this->service->startMaintenanceWindow($this->tenantId($request), $id, $request->user())]);
    }

    public function completeMaintenanceWindow(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-maintenance']);
        $data = $request->validate([
            'outcome' => 'nullable|string|max:4000',
        ]);

        return response()->json(['data' => $this->service->completeMaintenanceWindow($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function createSystemBanner(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-banners']);
        $data = $request->validate([
            'banner_type' => 'required|string|in:information,warning,urgent,maintenance,service_degradation,security_notice,policy_notice',
            'priority' => 'nullable|string|in:low,normal,high,critical',
            'audience' => 'nullable|array',
            'language' => 'nullable|string|in:en,fr,pt',
            'message' => 'required|string|max:4000',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after_or_equal:start_at',
            'dismissible' => 'nullable|boolean',
            'acknowledgement_required' => 'nullable|boolean',
            'secure_link' => 'nullable|string|max:255',
        ]);

        return response()->json(['data' => $this->service->createSystemBanner($this->tenantId($request), $data, $request->user())], 201);
    }

    public function dataQualityIssues(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-data-quality']);

        return response()->json(['data' => $this->service->dataQualityIssues($this->tenantId($request))]);
    }

    public function createDataCorrection(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.request-data-correction']);
        $data = $request->validate([
            'module' => 'required|string|max:80',
            'subject_type' => 'required|string|max:255',
            'subject_id' => 'required|string|max:255',
            'current_value_snapshot' => 'nullable|array',
            'proposed_change' => 'nullable|array',
            'reason' => 'required|string|max:2000',
            'evidence_document_id' => 'nullable|integer',
            'business_owner_id' => 'nullable|integer',
            'execution_method' => 'nullable|string|max:120',
        ]);
        $this->assertTenantUser($request, $data['business_owner_id'] ?? null);

        return response()->json(['data' => $this->service->createDataCorrection($this->tenantId($request), $data, $request->user())], 201);
    }

    public function approveDataCorrection(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.approve-data-correction']);

        return response()->json(['data' => $this->service->approveDataCorrection($this->tenantId($request), $id, $request->user())]);
    }

    public function executeDataCorrection(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.execute-data-correction']);

        return response()->json(['data' => $this->service->executeDataCorrection($this->tenantId($request), $id, $request->user())]);
    }

    public function backups(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-backups']);

        return response()->json(['data' => $this->service->backupStatus($this->tenantId($request))]);
    }

    public function requestRestore(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.request-restore']);
        $data = $request->validate([
            'restore_type' => 'required|string|in:test_restoration,single_document_restoration,record_recovery,point_in_time_database_recovery,disaster_recovery',
            'reason' => 'required|string|max:2000',
            'scope' => 'nullable|array',
            'target_environment' => 'required|string|in:development,testing,user_acceptance_testing,staging,production,disaster_recovery',
            'data_loss_impact' => 'nullable|string|max:4000',
            'security_review' => 'nullable|string|max:4000',
            'execution_owner_id' => 'nullable|integer',
        ]);
        $this->assertTenantUser($request, $data['execution_owner_id'] ?? null);

        return response()->json(['data' => $this->service->requestRestore($this->tenantId($request), $data, $request->user())], 201);
    }

    public function restoreRequests(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.view-restore']);

        return response()->json(['data' => $this->service->restoreRequests($this->tenantId($request))]);
    }

    public function approveRestore(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.approve-restore']);

        return response()->json(['data' => $this->service->approveRestore($this->tenantId($request), $id, $request->user())]);
    }

    public function executeRestore(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.execute-restore']);
        $data = $request->validate([
            'verification_status' => 'nullable|string|in:completed,failed,recorded_for_recovery_procedure',
            'verification_notes' => 'nullable|string|max:4000',
            'outcome' => 'nullable|string|max:4000',
        ]);

        return response()->json(['data' => $this->service->executeRestore($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function imports(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-data-quality']);

        return response()->json(['data' => $this->service->imports($this->tenantId($request))]);
    }

    public function migrations(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-data-quality']);

        return response()->json(['data' => $this->service->migrations($this->tenantId($request))]);
    }

    public function createSupportSession(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-support-sessions']);
        $data = $request->validate([
            'support_user_id' => 'nullable|integer',
            'ticket_reference' => 'required|string|max:120',
            'reason' => 'required|string|max:2000',
            'scope' => 'nullable|array',
            'starts_at' => 'nullable|date',
            'expires_at' => 'nullable|date|after:starts_at',
        ]);
        $this->assertTenantUser($request, $data['support_user_id'] ?? null);

        return response()->json(['data' => $this->service->createSupportSession($this->tenantId($request), $data, $request->user())], 201);
    }

    public function approveSupportSession(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-support-sessions']);

        return response()->json(['data' => $this->service->approveSupportSession($this->tenantId($request), $id, $request->user())]);
    }

    public function closeSupportSession(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.manage-support-sessions']);
        $data = $request->validate([
            'post_session_review' => 'nullable|array',
        ]);

        return response()->json(['data' => $this->service->closeSupportSession($this->tenantId($request), $id, $data, $request->user())]);
    }

    public function requestBreakGlass(Request $request): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.request-break-glass']);
        $data = $request->validate([
            'incident_reference' => 'required|string|max:120',
            'reason' => 'required|string|max:2000',
            'requested_permissions' => 'nullable|array',
            'starts_at' => 'nullable|date',
            'expires_at' => 'nullable|date|after:starts_at',
        ]);

        return response()->json(['data' => $this->service->requestBreakGlass($this->tenantId($request), $data, $request->user())], 201);
    }

    public function approveBreakGlass(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.approve-break-glass']);

        return response()->json(['data' => $this->service->approveBreakGlass($this->tenantId($request), $id, $request->user())]);
    }

    public function closeBreakGlass(Request $request, int $id): JsonResponse
    {
        $this->requirePerm($request, ['admin-console.request-break-glass', 'admin-console.approve-break-glass']);
        $data = $request->validate([
            'post_use_review' => 'nullable|array',
        ]);

        return response()->json(['data' => $this->service->closeBreakGlass($this->tenantId($request), $id, $data, $request->user())]);
    }

    private function tenantId(Request $request): int
    {
        return (int) $request->user()->tenant_id;
    }

    /**
     * @param  list<string>  $anyOf
     */
    private function requirePerm(Request $request, array $anyOf): void
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->isSystemAdmin() || $user->hasAnyRole(['System Admin', 'super-admin'])) {
            return;
        }

        foreach ($anyOf as $perm) {
            if ($user->can($perm)) {
                return;
            }
        }

        abort(403);
    }

    private function assertTenantUser(Request $request, ?int $userId): void
    {
        if (! $userId) {
            return;
        }

        $exists = User::query()
            ->where('tenant_id', $this->tenantId($request))
            ->whereKey($userId)
            ->exists();

        abort_unless($exists, 422, 'The selected user is not available in this tenant.');
    }
}
