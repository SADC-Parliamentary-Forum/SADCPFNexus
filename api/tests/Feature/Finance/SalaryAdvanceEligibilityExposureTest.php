<?php

namespace Tests\Feature\Finance;

use App\Models\BalanceRegister;
use App\Models\Payslip;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\SalaryAdvancePolicySeeder;
use Tests\TestCase;

class SalaryAdvanceEligibilityExposureTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SalaryAdvancePolicySeeder::class);
    }

    private function confirmedPayslip(User $user, float $net = 10000, float $gross = 15000): Payslip
    {
        return Payslip::create([
            'tenant_id'            => $user->tenant_id,
            'user_id'              => $user->id,
            'period_month'         => 6,
            'period_year'          => 2026,
            'gross_amount'         => $gross,
            'net_amount'           => $net,
            'currency'             => 'NAD',
            'confirmation_status'  => 'confirmed',
            'confirmed_at'         => now(),
            'confirmed_by'         => $user->id,
        ]);
    }

    public function test_max_eligible_uses_policy_percent_of_net(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->confirmedPayslip($user, 10000, 20000);

        $http->getJson('/api/v1/finance/advances/eligibility')
            ->assertOk()
            ->assertJsonPath('eligible', true)
            ->assertJsonPath('max_eligible', 5000)
            ->assertJsonPath('net_salary', 10000)
            ->assertJsonPath('salary_basis', 'net_confirmed')
            ->assertJsonPath('policy.recovery_rule', 'full_eom');
    }

    public function test_eligibility_blocks_when_bcre_balance_positive(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->confirmedPayslip($user);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $user->id,
            'reference_number' => 'ADV-OUT001',
            'advance_type'     => 'medical',
            'amount'           => 2000,
            'currency'         => 'NAD',
            'purpose'          => 'Outstanding',
            'justification'    => 'Prior advance still owing',
            'repayment_months' => 1,
            'status'           => 'paid',
        ]);

        BalanceRegister::create([
            'tenant_id'           => $tenant->id,
            'module_type'         => 'salary_advance',
            'employee_id'         => $user->id,
            'source_request_type' => SalaryAdvanceRequest::class,
            'source_request_id'   => $advance->id,
            'reference_number'    => 'BCR-OUT001',
            'approved_amount'     => 2000,
            'total_processed'     => 0,
            'balance'             => 2000,
            'status'              => 'active',
            'created_by'          => $user->id,
        ]);

        $http->getJson('/api/v1/finance/advances/eligibility')
            ->assertOk()
            ->assertJsonPath('eligible', false)
            ->assertJsonPath('exposure.has_outstanding_balance', true);
    }

    public function test_submit_blocked_when_approved_unpaid_exists(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->confirmedPayslip($user);

        SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $user->id,
            'reference_number' => 'ADV-APPR001',
            'advance_type'     => 'medical',
            'amount'           => 2000,
            'currency'         => 'NAD',
            'purpose'          => 'Approved unpaid',
            'justification'    => 'Blocks new submit',
            'repayment_months' => 1,
            'status'           => 'approved_for_payment',
        ]);

        $create = $http->postJson('/api/v1/finance/advances', [
            'advance_type'     => 'medical',
            'amount'           => 1000,
            'currency'         => 'NAD',
            'purpose'          => 'Second advance',
            'justification'    => 'Should be blocked',
            'repayment_months' => 1,
            'deduction_authority_confirmed' => true,
        ]);
        $id = $create->json('data.id');

        $http->postJson("/api/v1/finance/advances/{$id}/submit", [
            'deduction_authority_confirmed' => true,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['advance']);
    }

    public function test_submit_requires_deduction_authority(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->confirmedPayslip($user);

        $create = $http->postJson('/api/v1/finance/advances', [
            'advance_type'     => 'medical',
            'amount'           => 1000,
            'currency'         => 'NAD',
            'purpose'          => 'Need authority',
            'justification'    => 'Must confirm deduction',
            'repayment_months' => 1,
        ]);
        $id = $create->json('data.id');

        $http->postJson("/api/v1/finance/advances/{$id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['deduction_authority_confirmed']);
    }
}
