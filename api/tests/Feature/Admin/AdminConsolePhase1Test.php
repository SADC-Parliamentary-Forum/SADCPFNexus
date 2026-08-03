<?php

namespace Tests\Feature\Admin;

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminConsolePhase1Test extends TestCase
{
    public function test_admin_dashboard_is_permission_controlled(): void
    {
        $tenant = Tenant::factory()->create();

        [$staffHttp] = $this->asStaff($tenant);
        $staffHttp->getJson('/api/v1/admin/dashboard')->assertForbidden();

        [$adminHttp] = $this->asAdmin($tenant);
        $adminHttp->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.cards.modules_active', 17)
            ->assertJsonStructure([
                'data' => [
                    'status',
                    'cards',
                    'health' => ['overall_status', 'services'],
                ],
            ]);
    }

    public function test_high_risk_configuration_change_requires_independent_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp, $requester] = $this->asAdmin($tenant);
        $approver = $this->makeAdmin($tenant);

        $configuration = collect(
            $adminHttp->getJson('/api/v1/admin/configurations')
                ->assertOk()
                ->json('data')
        )->firstWhere('config_key', 'platform.maintenance_mode');

        $change = $adminHttp->postJson("/api/v1/admin/configurations/{$configuration['id']}/change-requests", [
            'proposed_value' => 'read_only',
            'reason' => 'Exercise controlled maintenance-mode approval.',
            'business_justification' => 'Operations rehearsal.',
        ])->assertCreated()->json('data');

        $adminHttp->postJson("/api/v1/admin/configuration-changes/{$change['id']}/validate")
            ->assertOk()
            ->assertJsonPath('data.validation_result.valid', true);

        $adminHttp->postJson("/api/v1/admin/configuration-changes/{$change['id']}/approve")
            ->assertStatus(422);

        $this->asUser($approver)
            ->postJson("/api/v1/admin/configuration-changes/{$change['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approver_id', $approver->id);

        $this->asUser($requester)
            ->postJson("/api/v1/admin/configuration-changes/{$change['id']}/activate")
            ->assertOk()
            ->assertJsonPath('data.activation_status', 'active')
            ->assertJsonPath('data.approved_by', $approver->id);

        $this->assertDatabaseHas('configuration_change_requests', [
            'id' => $change['id'],
            'tenant_id' => $tenant->id,
            'status' => 'active',
        ]);
    }

    public function test_feature_flag_lifecycle_is_available_through_admin_console(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp, $admin] = $this->asAdmin($tenant);

        $flag = $adminHttp->postJson('/api/v1/admin/feature-flags', [
            'flag_key' => 'reports.scheduled-mi.phase1',
            'description' => 'Scheduled management-information rollout.',
            'flag_type' => 'release',
            'default_enabled' => false,
            'environment' => 'testing',
            'rollback_plan' => 'Disable the flag.',
        ])->assertCreated()->json('data');

        $adminHttp->postJson("/api/v1/admin/feature-flags/{$flag['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by', $admin->id);

        $adminHttp->postJson("/api/v1/admin/feature-flags/{$flag['id']}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('feature_flags', [
            'tenant_id' => $tenant->id,
            'flag_key' => 'reports.scheduled-mi.phase1',
            'status' => 'active',
        ]);
    }

    public function test_high_risk_feature_flag_requires_independent_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);
        $approver = $this->makeAdmin($tenant);

        $flag = $adminHttp->postJson('/api/v1/admin/feature-flags', [
            'flag_key' => 'documents.upload.kill-switch',
            'description' => 'Emergency upload kill switch.',
            'flag_type' => 'emergency_kill_switch',
            'default_enabled' => false,
            'environment' => 'testing',
            'rollback_plan' => 'Disable the switch after mitigation.',
        ])->assertCreated()->json('data');

        $adminHttp->postJson("/api/v1/admin/feature-flags/{$flag['id']}/approve")
            ->assertStatus(422);

        $this->asUser($approver)
            ->postJson("/api/v1/admin/feature-flags/{$flag['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by', $approver->id);
    }

    public function test_maintenance_mode_requires_independent_approval_and_blocks_writes(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);
        $approver = $this->makeAdmin($tenant);

        $module = collect($adminHttp->getJson('/api/v1/admin/modules')->assertOk()->json('data'))->first();
        $window = $adminHttp->postJson('/api/v1/admin/maintenance-windows', [
            'title' => 'Read-only maintenance test',
            'purpose' => 'Verify server-side write blocking.',
            'affected_services' => ['platform'],
            'planned_start' => now()->subMinute()->toIso8601String(),
            'planned_end' => now()->addHour()->toIso8601String(),
            'maintenance_mode' => 'read_only',
        ])->assertCreated()->json('data');

        $adminHttp->postJson("/api/v1/admin/maintenance-windows/{$window['id']}/approve")
            ->assertStatus(422);

        $this->asUser($approver)
            ->postJson("/api/v1/admin/maintenance-windows/{$window['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->asUser($approver)
            ->postJson("/api/v1/admin/maintenance-windows/{$window['id']}/start")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $adminHttp->postJson("/api/v1/admin/modules/{$module['id']}/change-status", [
            'status' => 'read_only',
            'reason' => 'This write should be blocked by maintenance mode.',
        ])->assertStatus(503);

        $adminHttp->getJson('/api/v1/admin/platform-status')
            ->assertOk()
            ->assertJsonPath('data.maintenance_active', true);
    }

    public function test_break_glass_approval_blocks_self_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);
        $approver = $this->makeAdmin($tenant);

        $session = $adminHttp->postJson('/api/v1/admin/break-glass', [
            'incident_reference' => 'INC-2026-0001',
            'reason' => 'Emergency operations test.',
            'requested_permissions' => ['admin-console.view-health'],
        ])->assertCreated()->json('data');

        $adminHttp->postJson("/api/v1/admin/break-glass/{$session['id']}/approve")
            ->assertStatus(422);

        $this->asUser($approver)
            ->postJson("/api/v1/admin/break-glass/{$session['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.approved_by', $approver->id);
    }

    public function test_controlled_data_correction_blocks_requester_self_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);
        $approver = $this->makeAdmin($tenant);

        $correction = $adminHttp->postJson('/api/v1/admin/data-corrections', [
            'module' => 'pif',
            'subject_type' => 'ProgrammeRequest',
            'subject_id' => 'PIF-2026-0001',
            'current_value_snapshot' => ['status' => 'stuck'],
            'proposed_change' => ['status' => 'returned'],
            'reason' => 'Controlled correction test.',
            'execution_method' => 'workflow_state_repair',
        ])->assertCreated()->json('data');

        $adminHttp->postJson("/api/v1/admin/data-corrections/{$correction['id']}/approve")
            ->assertStatus(422);

        $this->asUser($approver)
            ->postJson("/api/v1/admin/data-corrections/{$correction['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->asUser($approver)
            ->postJson("/api/v1/admin/data-corrections/{$correction['id']}/execute")
            ->assertOk()
            ->assertJsonPath('data.status', 'executed');

        $executed = DB::table('data_correction_requests')->where('id', $correction['id'])->first();
        $this->assertNotNull($executed?->verification_result);
    }

    public function test_restore_request_records_controlled_backup_recovery_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);

        $restore = $adminHttp->postJson('/api/v1/admin/restore-requests', [
            'restore_type' => 'test_restoration',
            'reason' => 'Quarterly restore verification.',
            'target_environment' => 'staging',
            'scope' => ['database' => true],
        ])->assertCreated()->json('data');

        $this->assertDatabaseHas('restore_requests', [
            'id' => $restore['id'],
            'tenant_id' => $tenant->id,
            'restore_type' => 'test_restoration',
            'status' => 'requested',
        ]);
    }

    public function test_restore_request_requires_independent_approval_before_execution(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp, $requester] = $this->asAdmin($tenant);
        $approver = $this->makeAdmin($tenant);

        $restore = $adminHttp->postJson('/api/v1/admin/restore-requests', [
            'restore_type' => 'test_restoration',
            'reason' => 'Verify four-eyes recovery control.',
            'target_environment' => 'staging',
        ])->assertCreated()->json('data');

        $adminHttp->getJson('/api/v1/admin/restore-requests')
            ->assertOk()
            ->assertJsonPath('data.0.id', $restore['id']);

        $adminHttp->postJson("/api/v1/admin/restore-requests/{$restore['id']}/approve")
            ->assertStatus(422);

        $this->asUser($approver)
            ->postJson("/api/v1/admin/restore-requests/{$restore['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.approved_by', $approver->id);

        $this->asUser($requester)
            ->postJson("/api/v1/admin/restore-requests/{$restore['id']}/execute", [
                'verification_status' => 'completed',
                'verification_notes' => 'Recovery procedure completed and verified.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.execution_owner_id', $requester->id);
    }
}
