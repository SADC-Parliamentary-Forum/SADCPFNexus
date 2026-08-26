<?php

namespace Tests\Feature\Finance;

use App\Models\BalanceRegister;
use App\Models\Payslip;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\SalaryAdvancePolicySeeder;
use Tests\TestCase;

class SalaryAdvanceLifecycleTest extends TestCase
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

    private function approvedForPayment(Tenant $tenant): array
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

        // Legacy path (no workflow in this helper): SG final approve
        [$sgHttp] = $this->asSG($tenant);
        $sgHttp->postJson("/api/v1/finance/advances/{$id}/approve", [
            'comment' => 'Final approval',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved_for_payment');

        $finHttp = $this->asUser($finance);

        $advance = SalaryAdvanceRequest::findOrFail($id);
        $this->assertNull(
            BalanceRegister::where('source_request_type', SalaryAdvanceRequest::class)
                ->where('source_request_id', $advance->id)
                ->first()
        );

        return [$advance, $staff, $finHttp];
    }

    public function test_approve_does_not_create_bcre_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance] = $this->approvedForPayment($tenant);

        $this->assertSame('approved_for_payment', $advance->fresh()->status);
        $this->assertDatabaseMissing('balance_registers', [
            'source_request_id' => $advance->id,
            'source_request_type' => SalaryAdvanceRequest::class,
        ]);
    }

    public function test_record_payment_creates_bcre_and_marks_paid(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->approvedForPayment($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-payment", [
            'payment_reference' => 'PAY-001',
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-07-20',
        ])->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $register = BalanceRegister::where('source_request_type', SalaryAdvanceRequest::class)
            ->where('source_request_id', $advance->id)
            ->first();

        $this->assertNotNull($register);
        $this->assertEquals(2000.0, (float) $register->balance);
        $this->assertEquals(1, (int) $register->fresh()->transactions()->count());
    }

    public function test_schedule_and_record_recovery_closes_when_full(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, $staff, $finHttp] = $this->approvedForPayment($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-payment", [
            'payment_reference' => 'PAY-002',
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-07-20',
        ])->assertOk();

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/schedule-recovery", [
            'intended_recovery_payroll_date' => '2026-07-31',
        ])->assertOk()
            ->assertJsonPath('data.status', 'recovery_scheduled');

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount' => 2000,
            'reference_doc' => 'PAYROLL-JUL',
            'notes' => 'Full EOM recovery',
        ])->assertOk();

        $advance->refresh();
        $this->assertContains($advance->status, ['recovered', 'closed']);

        $register = BalanceRegister::where('source_request_type', SalaryAdvanceRequest::class)
            ->where('source_request_id', $advance->id)
            ->first();
        $this->assertEquals(0.0, (float) $register->balance);

        // New advance allowed after close (payslip already exists from setup)
        $http = $this->asUser($staff);
        $create = $http->postJson('/api/v1/finance/advances', [
            'advance_type' => 'school',
            'amount' => 1000,
            'currency' => 'NAD',
            'purpose' => 'School fees',
            'justification' => 'Term fees',
            'repayment_months' => 1,
            'deduction_authority_confirmed' => true,
        ]);
        $newId = $create->json('data.id');
        $http->postJson("/api/v1/finance/advances/{$newId}/submit", [
            'deduction_authority_confirmed' => true,
        ])->assertOk();
    }

    public function test_partial_recovery_sets_reconciliation_required(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->approvedForPayment($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-payment", [
            'payment_reference' => 'PAY-003',
            'payment_method' => 'bank_transfer',
            'payment_date' => '2026-07-20',
        ])->assertOk();

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount' => 500,
            'reference_doc' => 'PARTIAL',
        ])->assertOk()
            ->assertJsonPath('data.status', 'reconciliation_required');
    }

    public function test_ledger_and_pdf_authorised_for_owner(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, $staff, $finHttp] = $this->approvedForPayment($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-payment", [
            'payment_reference' => 'PAY-004',
            'payment_method' => 'cash',
            'payment_date' => '2026-07-20',
        ])->assertOk();

        $this->asUser($staff)
            ->getJson("/api/v1/finance/advances/{$advance->id}/ledger")
            ->assertOk()
            ->assertJsonStructure(['data' => ['register', 'transactions']]);

        $this->asUser($staff)
            ->get("/api/v1/finance/advances/{$advance->id}/pdf")
            ->assertOk();
    }

    public function test_peer_cannot_view_ledger_or_pdf(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->approvedForPayment($tenant);
        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-payment", [
            'payment_reference' => 'PAY-005',
            'payment_method' => 'cash',
            'payment_date' => '2026-07-20',
        ])->assertOk();

        $peer = $this->makeUser('staff', $tenant);
        $this->asUser($peer)
            ->getJson("/api/v1/finance/advances/{$advance->id}/ledger")
            ->assertForbidden();
        $this->asUser($peer)
            ->get("/api/v1/finance/advances/{$advance->id}/pdf")
            ->assertForbidden();
    }
}
