<?php

namespace Tests\Feature\Delegation;

use App\Models\ApprovalRequest;
use App\Models\DelegatedAuthority;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * WS1 — Delegation granularity + "prepared on behalf of" + workflow visibility.
 * Covers PRD §6.2, §7.1, §7.2, §8, §28.1, §28.2.
 */
class DelegationWorkflowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function makeDelegation(Tenant $tenant, int $principalId, int $delegateId, array $overrides = []): DelegatedAuthority
    {
        return DelegatedAuthority::create(array_merge([
            'tenant_id'         => $tenant->id,
            'principal_user_id' => $principalId,
            'delegate_user_id'  => $delegateId,
            'start_date'        => now()->subDay()->toDateString(),
            'end_date'          => now()->addDays(7)->toDateString(),
            'module'            => 'leave',
            'can_draft'         => true,
            'can_submit'        => true,
            'can_upload'        => true,
            'can_act_on_behalf' => true,
            'created_by'        => $principalId,
        ], $overrides));
    }

    // ── Granularity ───────────────────────────────────────────────────────────

    public function test_admin_can_create_granular_delegation(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp, $admin] = $this->asAdmin($tenant);
        $delegate = $this->makeUser('staff', $tenant);

        $adminHttp->postJson('/api/v1/saam/delegations', [
            'delegate_user_id' => $delegate->id,
            'start_date'       => now()->toDateString(),
            'end_date'         => now()->addDays(5)->toDateString(),
            'module'           => 'travel',
            'can_draft'        => true,
            'can_submit'       => false,
            'can_upload'       => true,
            'can_act_on_behalf'=> true,
            'requires_principal_confirmation' => true,
        ])->assertCreated()
          ->assertJsonPath('data.module', 'travel')
          ->assertJsonPath('data.can_submit', false);

        $this->assertDatabaseHas('delegated_authorities', [
            'delegate_user_id'                => $delegate->id,
            'module'                          => 'travel',
            'can_submit'                      => false,
            'requires_principal_confirmation' => true,
        ]);
    }

    public function test_permits_respects_module_and_action_scope(): void
    {
        $tenant    = Tenant::factory()->create();
        $principal = $this->makeUser('staff', $tenant);
        $delegate  = $this->makeUser('staff', $tenant);

        $d = $this->makeDelegation($tenant, $principal->id, $delegate->id, [
            'module'      => 'leave',
            'can_submit'  => false,
        ]);

        $this->assertTrue($d->permits('draft', 'leave'));
        $this->assertFalse($d->permits('submit', 'leave'));
        $this->assertFalse($d->permits('draft', 'travel')); // wrong module
    }

    public function test_resolve_finds_active_delegation(): void
    {
        $tenant    = Tenant::factory()->create();
        $principal = $this->makeUser('staff', $tenant);
        $delegate  = $this->makeUser('staff', $tenant);
        $this->makeDelegation($tenant, $principal->id, $delegate->id);

        $resolved = DelegatedAuthority::resolve($delegate->id, $principal->id, 'draft', 'leave');
        $this->assertNotNull($resolved);

        // expired delegation should not resolve
        $expired = DelegatedAuthority::resolve($delegate->id, $principal->id, 'draft', 'procurement');
        $this->assertNull($expired);
    }

    // ── Prepared on behalf of ───────────────────────────────────────────────────

    public function test_delegate_can_prepare_leave_on_behalf_of_principal(): void
    {
        $tenant    = Tenant::factory()->create();
        $principal = $this->makeUser('staff', $tenant);
        $delegate  = $this->makeUser('staff', $tenant);
        $this->makeDelegation($tenant, $principal->id, $delegate->id);

        $resp = $this->asUser($delegate)->postJson('/api/v1/leave/requests', [
            'leave_type'            => 'annual',
            'start_date'            => now()->addDays(7)->toDateString(),
            'end_date'              => now()->addDays(9)->toDateString(),
            'reason'                => 'Prepared by assistant',
            'prepared_on_behalf_of' => $principal->id,
        ]);

        $resp->assertCreated();
        $leaveId = $resp->json('data.id');

        // The leave belongs to the principal; the delegate is recorded as preparer.
        $this->assertDatabaseHas('leave_requests', [
            'id'                    => $leaveId,
            'requester_id'          => $principal->id,
            'prepared_by'           => $delegate->id,
            'prepared_on_behalf_of' => $principal->id,
        ]);

        // A "delegation used" audit entry must exist.
        $this->assertDatabaseHas('audit_logs', ['event' => 'delegation.used']);
    }

    public function test_prepare_on_behalf_without_delegation_is_rejected(): void
    {
        $tenant    = Tenant::factory()->create();
        $principal = $this->makeUser('staff', $tenant);
        $delegate  = $this->makeUser('staff', $tenant);

        $this->asUser($delegate)->postJson('/api/v1/leave/requests', [
            'leave_type'            => 'annual',
            'start_date'            => now()->addDays(7)->toDateString(),
            'end_date'              => now()->addDays(9)->toDateString(),
            'prepared_on_behalf_of' => $principal->id,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['prepared_on_behalf_of']);
    }

    // ── Workflow visibility snapshot ────────────────────────────────────────────

    public function test_workflow_snapshot_exposes_visibility_fields(): void
    {
        $tenant  = Tenant::factory()->create();
        $staff   = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        // Seed a single-step leave workflow assigning the manager directly.
        $workflow = \App\Models\ApprovalWorkflow::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Leave Approval',
            'module_type' => 'leave',
            'is_active'   => true,
        ]);
        $workflow->steps()->create([
            'step_order'    => 0,
            'step_name'     => 'Manager Review',
            'approver_type' => 'specific_user',
            'user_id'       => $manager->id,
        ]);

        $staffHttp = $this->asUser($staff);
        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(7)->toDateString(),
            'end_date'   => now()->addDays(9)->toDateString(),
            'reason'     => 'Vacation',
        ]);
        $leaveId = $create->json('data.id');
        $staffHttp->postJson("/api/v1/leave/requests/{$leaveId}/submit");

        $ar = ApprovalRequest::where('approvable_type', LeaveRequest::class)
            ->where('approvable_id', $leaveId)->first();

        $this->assertNotNull($ar, 'Workflow should have been initiated on submit.');

        $this->asUser($manager)
            ->getJson("/api/v1/approvals/{$ar->id}/snapshot")
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'status', 'current_step_index', 'currently_with',
                    'submitted_by', 'steps', 'history', 'current_stage',
                ],
            ])
            ->assertJsonPath('data.currently_with.0.id', $manager->id)
            ->assertJsonPath('data.submitted_by.id', $staff->id);
    }
}
