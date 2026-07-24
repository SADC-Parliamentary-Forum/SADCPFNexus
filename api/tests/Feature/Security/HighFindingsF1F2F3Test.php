<?php

namespace Tests\Feature\Security;

use App\Models\ImprestRequest;
use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\User;
use Tests\TestCase;

/**
 * Regression tests for High findings F1–F3 from the 2026-07-24 security scan.
 */
class HighFindingsF1F2F3Test extends TestCase
{
    // ── F1: Privilege escalation via self admin user update ───────────────────

    public function test_staff_cannot_update_own_admin_user_record(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $staff] = $this->asStaff($tenant);

        $http->putJson("/api/v1/admin/users/{$staff->id}", [
            'name'           => $staff->name,
            'role'           => 'System Admin',
            'classification' => 'SECRET',
        ])->assertForbidden();

        $staff->refresh();
        $this->assertFalse($staff->hasRole('System Admin'));
        $this->assertNotSame('SECRET', $staff->classification);
    }

    public function test_staff_cannot_escalate_role_even_if_policy_were_bypassed_via_service_guard(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $service = app(\App\Modules\UserManagement\Services\UserService::class);

        $service->update($staff, [
            'role'           => 'System Admin',
            'classification' => 'SECRET',
            'name'           => 'Hacked',
        ], $staff);

        $staff->refresh();
        $this->assertFalse($staff->hasRole('System Admin'));
        $this->assertNotSame('SECRET', $staff->classification);
        // Non-privileged name change is also blocked when updater is not admin
        // (service strips privileged fields; name is allowed only if present —
        // non-admin path still updates non-privileged fields if somehow called).
        // Name is not privileged, so it may update — assert role/classification only.
    }

    public function test_admin_can_still_update_user_role(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $user = User::factory()->create([
            'tenant_id'      => $tenant->id,
            'classification' => 'UNCLASSIFIED',
        ]);
        $user->assignRole('staff');

        $http->putJson("/api/v1/admin/users/{$user->id}", [
            'name'           => $user->name,
            'role'           => 'Finance Controller',
            'classification' => 'RESTRICTED',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue($user->hasRole('Finance Controller'));
        $this->assertSame('RESTRICTED', $user->classification);
    }

    // ── F2: Certificate IDOR ──────────────────────────────────────────────────

    public function test_peer_cannot_read_another_users_leave_certificate(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);

        $leave = LeaveRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'LV-CERT-001',
            'leave_type'       => 'annual',
            'start_date'       => now()->addDays(5)->toDateString(),
            'end_date'         => now()->addDays(6)->toDateString(),
            'days_requested'   => 2,
            'reason'           => 'Sensitive medical reason',
            'status'           => 'approved',
        ]);

        $this->asUser($peer)
            ->getJson("/api/v1/leave/requests/{$leave->id}/certificate")
            ->assertForbidden();
    }

    public function test_owner_can_read_own_salary_advance_certificate(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $owner] = $this->asStaff($tenant);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'ADV-CERT-OWN',
            'advance_type'     => 'medical',
            'amount'           => 1000,
            'currency'         => 'NAD',
            'purpose'          => 'Own cert',
            'justification'    => 'Own cert justification',
            'repayment_months' => 1,
            'status'           => 'approved',
        ]);

        $http->getJson("/api/v1/finance/advances/{$advance->id}/certificate")
            ->assertOk();
    }

    public function test_peer_cannot_read_salary_advance_travel_imprest_procurement_certificates(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'ADV-CERT-PEER',
            'advance_type'     => 'medical',
            'amount'           => 2000,
            'currency'         => 'NAD',
            'purpose'          => 'Peer leak test',
            'justification'    => 'Should not be visible',
            'repayment_months' => 2,
            'status'           => 'approved',
        ]);

        $travel = TravelRequest::create([
            'tenant_id'           => $tenant->id,
            'requester_id'        => $owner->id,
            'reference_number'    => 'TRV-CERT-PEER',
            'destination_country' => 'Namibia',
            'destination_city'    => 'Windhoek',
            'purpose'             => 'Secret mission',
            'departure_date'      => now()->addDays(3)->toDateString(),
            'return_date'         => now()->addDays(5)->toDateString(),
            'currency'            => 'NAD',
            'status'              => 'approved',
        ]);

        $imprest = ImprestRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'IMP-CERT-PEER',
            'budget_line'      => 'OPS-001',
            'amount_requested' => 500,
            'currency'         => 'NAD',
            'purpose'          => 'Cash float',
            'justification'    => 'Hidden justification',
            'status'           => 'approved',
        ]);

        $procurement = ProcurementRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'PRC-CERT-PEER',
            'title'            => 'Sensitive purchase',
            'description'      => 'Should not leak',
            'justification'    => 'Hidden',
            'estimated_value'  => 10000,
            'currency'         => 'NAD',
            'status'           => 'approved',
        ]);

        $http = $this->asUser($peer);
        $http->getJson("/api/v1/finance/advances/{$advance->id}/certificate")->assertForbidden();
        $http->getJson("/api/v1/travel/requests/{$travel->id}/certificate")->assertForbidden();
        $http->getJson("/api/v1/imprest/requests/{$imprest->id}/certificate")->assertForbidden();
        $http->getJson("/api/v1/procurement/requests/{$procurement->id}/certificate")->assertForbidden();
    }

    // ── F3: Salary-advance approval bypass ────────────────────────────────────

    public function test_governance_officer_cannot_legacy_approve_salary_advance(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $gov = $this->makeGovernanceOfficer($tenant);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'ADV-BYPASS-001',
            'advance_type'     => 'medical',
            'amount'           => 1500,
            'currency'         => 'NAD',
            'purpose'          => 'Bypass test',
            'justification'    => 'Must not be approvable by governance',
            'repayment_months' => 1,
            'status'           => 'submitted',
        ]);

        $this->asUser($gov)
            ->postJson("/api/v1/finance/advances/{$advance->id}/approve", [
                'comment' => 'Illicit approve',
            ])
            ->assertForbidden();

        $this->assertSame('submitted', $advance->fresh()->status);
    }

    public function test_hr_manager_cannot_legacy_approve_salary_advance(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $hr = $this->makeHrManager($tenant);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $owner->id,
            'reference_number' => 'ADV-BYPASS-002',
            'advance_type'     => 'rental',
            'amount'           => 1500,
            'currency'         => 'NAD',
            'purpose'          => 'HR bypass test',
            'justification'    => 'HR must not approve advances without finance.approve',
            'repayment_months' => 1,
            'status'           => 'submitted',
        ]);

        $this->asUser($hr)
            ->postJson("/api/v1/finance/advances/{$advance->id}/approve", [
                'comment' => 'Illicit HR approve',
            ])
            ->assertForbidden();

        $this->assertSame('submitted', $advance->fresh()->status);
    }

    public function test_salary_advance_workflow_is_seeded(): void
    {
        $tenant = Tenant::factory()->create();
        $this->seed(\Database\Seeders\WorkflowSeeder::class);

        $this->assertDatabaseHas('approval_workflows', [
            'tenant_id'   => $tenant->id,
            'module_type' => 'salary_advance',
            'is_active'   => true,
        ]);
    }
}
