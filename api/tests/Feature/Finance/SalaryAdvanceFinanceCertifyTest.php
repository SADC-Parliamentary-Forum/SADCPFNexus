<?php

namespace Tests\Feature\Finance;

use App\Models\Payslip;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\SalaryAdvancePolicySeeder;
use Tests\TestCase;

class SalaryAdvanceFinanceCertifyTest extends TestCase
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

    private function submittedAdvance(Tenant $tenant, User $staff): SalaryAdvanceRequest
    {
        $this->confirmedPayslip($staff);
        [$http] = [$this->asUser($staff), $staff];

        $create = $http->postJson('/api/v1/finance/advances', [
            'advance_type' => 'medical',
            'amount' => 2000,
            'currency' => 'NAD',
            'purpose' => 'Medical',
            'justification' => 'Surgery costs',
            'repayment_months' => 1,
            'deduction_authority_confirmed' => true,
        ]);
        $id = $create->json('data.id');
        $http->postJson("/api/v1/finance/advances/{$id}/submit", [
            'deduction_authority_confirmed' => true,
        ])->assertOk();

        return SalaryAdvanceRequest::findOrFail($id);
    }

    public function test_staff_cannot_finance_certify(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $advance = $this->submittedAdvance($tenant, $staff);
        $peer = $this->makeUser('staff', $tenant);

        $this->asUser($peer)
            ->postJson("/api/v1/finance/advances/{$advance->id}/finance-certify", [
                'confirmed_net_salary' => 10000,
                'intended_recovery_payroll_date' => '2026-07-31',
                'eligible' => true,
                'comments' => 'ok',
            ])
            ->assertForbidden();
    }

    public function test_finance_can_certify_and_writes_review(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $advance = $this->submittedAdvance($tenant, $staff);

        [$finHttp] = $this->asFinanceController($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/finance-certify", [
            'confirmed_net_salary' => 10000,
            'confirmed_gross_salary' => 15000,
            'intended_recovery_payroll_date' => '2026-07-31',
            'eligible' => true,
            'comments' => 'Part B complete',
        ])->assertOk()
            ->assertJsonPath('data.status', 'finance_certified');

        $this->assertDatabaseHas('salary_advance_finance_reviews', [
            'salary_advance_request_id' => $advance->id,
            'outcome' => 'certified',
        ]);
        $this->assertNotNull($advance->fresh()->finance_certified_at);
    }

    public function test_requester_cannot_self_certify(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $advance = $this->submittedAdvance($tenant, $staff);

        // Give requester finance certify permission but SoD must still block.
        $staff->givePermissionTo('salary_advance.certify');

        $this->asUser($staff)
            ->postJson("/api/v1/finance/advances/{$advance->id}/finance-certify", [
                'confirmed_net_salary' => 10000,
                'intended_recovery_payroll_date' => '2026-07-31',
                'eligible' => true,
                'comments' => 'self',
            ])
            ->assertForbidden();
    }

    public function test_finance_queue_lists_pending_certify(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->submittedAdvance($tenant, $staff);

        [$finHttp] = $this->asFinanceController($tenant);

        $finHttp->getJson('/api/v1/finance/advances?queue=certify')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'submitted');
    }

    public function test_finance_queue_lists_payment_and_recovery(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $advance = $this->submittedAdvance($tenant, $staff);

        [$finHttp, $finance] = $this->asFinanceController($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/finance-certify", [
            'confirmed_net_salary' => 10000,
            'intended_recovery_payroll_date' => '2026-07-31',
            'eligible' => true,
            'comments' => 'Certified',
        ])->assertOk();

        [$sgHttp] = $this->asSG($tenant);
        $sgHttp->postJson("/api/v1/finance/advances/{$advance->id}/approve", [
            'comment' => 'Final approval',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved_for_payment');

        $finHttp = $this->asUser($finance);
        $finHttp->getJson('/api/v1/finance/advances?queue=payment')
            ->assertOk()
            ->assertJsonFragment(['id' => $advance->id, 'status' => 'approved_for_payment']);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-payment", [
            'payment_reference' => 'PAY-Q-1',
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-07-01',
        ])->assertOk();

        $finHttp->getJson('/api/v1/finance/advances?queue=recovery')
            ->assertOk()
            ->assertJsonFragment(['id' => $advance->id, 'status' => 'paid']);
    }
}
