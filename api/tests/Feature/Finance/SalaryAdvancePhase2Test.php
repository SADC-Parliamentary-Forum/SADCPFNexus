<?php

namespace Tests\Feature\Finance;

use App\Models\Payslip;
use App\Models\SalaryAdvancePolicyVersion;
use App\Models\SalaryAdvanceReconciliation;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\SalaryAdvancePolicySeeder;
use Tests\TestCase;

class SalaryAdvancePhase2Test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SalaryAdvancePolicySeeder::class);
    }

    private function confirmedPayslip(User $user, float $net = 10000): Payslip
    {
        return Payslip::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'period_month' => 6,
            'period_year' => 2026,
            'gross_amount' => 15000,
            'net_amount' => $net,
            'currency' => 'NAD',
            'confirmation_status' => 'confirmed',
            'confirmed_at' => now(),
            'confirmed_by' => $user->id,
        ]);
    }

    private function paidWithPartialRecovery(Tenant $tenant): array
    {
        $staff = $this->makeUser('staff', $tenant);
        $this->confirmedPayslip($staff);

        $http = $this->asUser($staff);
        $create = $http->postJson('/api/v1/finance/advances', [
            'advance_type' => 'medical',
            'amount' => 2000,
            'currency' => 'NAD',
            'purpose' => 'Medical',
            'justification' => 'Surgery',
            'repayment_months' => 1,
            'deduction_authority_confirmed' => true,
        ]);
        $id = $create->json('data.id');
        $http->postJson("/api/v1/finance/advances/{$id}/submit", [
            'deduction_authority_confirmed' => true,
        ])->assertOk();

        [$finHttp, $finance] = $this->asFinanceController($tenant);
        $finHttp->postJson("/api/v1/finance/advances/{$id}/finance-certify", [
            'confirmed_net_salary' => 10000,
            'intended_recovery_payroll_date' => '2026-07-31',
            'eligible' => true,
            'comments' => 'Certified',
        ])->assertOk();

        [$sgHttp] = $this->asSG($tenant);
        $sgHttp->postJson("/api/v1/finance/advances/{$id}/approve", [
            'comment' => 'Final approval',
        ])->assertOk();

        $finHttp = $this->asUser($finance);
        $finHttp->postJson("/api/v1/finance/advances/{$id}/record-payment", [
            'payment_reference' => 'PAY-P2',
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-07-20',
        ])->assertOk();

        $finHttp->postJson("/api/v1/finance/advances/{$id}/record-recovery", [
            'amount' => 500,
            'reference_doc' => 'PARTIAL-P2',
        ])->assertOk()
            ->assertJsonPath('data.status', 'reconciliation_required');

        return [SalaryAdvanceRequest::findOrFail($id), $staff, $finHttp];
    }

    public function test_partial_recovery_creates_reconciliation_record(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->paidWithPartialRecovery($tenant);

        $this->assertDatabaseHas('salary_advance_reconciliations', [
            'salary_advance_request_id' => $advance->id,
            'status' => 'open',
        ]);

        $finHttp->getJson('/api/v1/finance/advances/reconciliations')
            ->assertOk()
            ->assertJsonPath('data.0.salary_advance_request_id', $advance->id);
    }

    public function test_resolve_reconciliation_closes_record_and_can_close_advance(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->paidWithPartialRecovery($tenant);

        $recon = SalaryAdvanceReconciliation::where('salary_advance_request_id', $advance->id)->firstOrFail();

        // Record remaining recovery then resolve
        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount' => 1500,
            'reference_doc' => 'BALANCE',
        ])->assertOk();

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/reconciliations/{$recon->id}/resolve", [
            'resolution_notes' => 'Balance recovered after payroll correction',
            'outcome' => 'balanced',
        ])->assertOk()
            ->assertJsonPath('data.status', 'resolved');

        $this->assertSame('resolved', $recon->fresh()->status);
    }

    public function test_finance_dashboard_returns_queue_counts(): void
    {
        $tenant = Tenant::factory()->create();
        [$finHttp] = $this->asFinanceController($tenant);

        $finHttp->getJson('/api/v1/finance/advances/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'queues' => [
                        'certify',
                        'pending_approval',
                        'payment',
                        'recovery',
                        'reconciliation',
                        'outstanding',
                    ],
                    'exposure' => [
                        'total_outstanding_balance',
                        'outstanding_count',
                    ],
                ],
            ]);
    }

    public function test_employee_summary_returns_eligibility_and_history(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->confirmedPayslip($staff);

        $this->asUser($staff)
            ->getJson('/api/v1/finance/advances/employee-summary')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'eligibility',
                    'current_request',
                    'active_advance',
                    'history',
                ],
            ]);
    }

    public function test_queue_outstanding_lists_positive_balance_registers(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->paidWithPartialRecovery($tenant);

        $finHttp->getJson('/api/v1/finance/advances?queue=outstanding')
            ->assertOk()
            ->assertJsonFragment(['id' => $advance->id]);
    }

    public function test_queue_history_lists_closed_for_requester(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->confirmedPayslip($staff);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'reference_number' => 'ADV-HIST01',
            'advance_type' => 'medical',
            'amount' => 1000,
            'currency' => 'NAD',
            'repayment_months' => 1,
            'purpose' => 'Past',
            'justification' => 'Closed history',
            'status' => 'closed',
            'closed_at' => now(),
        ]);

        $this->asUser($staff)
            ->getJson('/api/v1/finance/advances?queue=history')
            ->assertOk()
            ->assertJsonFragment(['id' => $advance->id]);
    }

    public function test_new_policy_version_deactivates_previous_and_audits(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo('salary_advance.admin');

        $before = SalaryAdvancePolicyVersion::activeFor($tenant->id);
        $this->assertNotNull($before);
        $this->assertTrue((bool) $before->active);

        $this->asUser($admin)
            ->postJson('/api/v1/finance/advances/policies', [
                'version' => '2026.2',
                'effective_from' => '2026-08-01',
                'max_salary_percentage' => 50,
                'salary_basis' => 'net_confirmed',
                'max_concurrent_advances' => 1,
                'full_repayment_required' => true,
                'recovery_rule' => 'full_eom',
                'final_approver_role' => 'Secretary General',
                'finance_certification_required' => true,
                'admin_review_required' => true,
                'change_reason' => 'Annual policy refresh',
            ])
            ->assertCreated()
            ->assertJsonPath('data.version', '2026.2')
            ->assertJsonPath('data.active', true);

        $active = SalaryAdvancePolicyVersion::activeFor($tenant->id);
        $this->assertSame('2026.2', $active->version);
        $this->assertNotEquals($before->id, $active->id);
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'salary_advance.policy_version_created',
        ]);
    }

    public function test_staff_cannot_create_policy_version(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $this->asUser($staff)
            ->postJson('/api/v1/finance/advances/policies', [
                'version' => '2026.hack',
                'effective_from' => '2026-08-01',
                'max_salary_percentage' => 90,
                'change_reason' => 'Nope',
            ])
            ->assertForbidden();
    }

    public function test_payroll_integration_stub_returns_manual_mode(): void
    {
        $tenant = Tenant::factory()->create();
        [$finHttp] = $this->asFinanceController($tenant);

        $finHttp->getJson('/api/v1/finance/advances/payroll-integration')
            ->assertOk()
            ->assertJsonPath('data.mode', 'manual')
            ->assertJsonPath('data.enabled', false);
    }
}
