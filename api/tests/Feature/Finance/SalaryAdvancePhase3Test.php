<?php

namespace Tests\Feature\Finance;

use App\Models\AuditLog;
use App\Models\BalanceRegister;
use App\Models\HrFileDocument;
use App\Models\HrPersonalFile;
use App\Models\Payslip;
use App\Models\SalaryAdvancePolicyException;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface;
use App\Modules\Finance\Services\ManualPayrollRecoveryAdapter;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SalaryAdvancePhase3Test extends TestCase
{
    private function confirmedPayslip(User $user, float $net = 10000): Payslip
    {
        return Payslip::create([
            'tenant_id'           => $user->tenant_id,
            'user_id'             => $user->id,
            'period_month'        => 6,
            'period_year'         => 2026,
            'gross_amount'        => 15000,
            'net_amount'          => $net,
            'currency'            => 'NAD',
            'confirmation_status' => 'confirmed',
            'confirmed_at'        => now(),
            'confirmed_by'        => $user->id,
        ]);
    }

    private function paidAdvance(Tenant $tenant, float $amount = 2000): array
    {
        $staff = $this->makeUser('staff', $tenant);
        $this->confirmedPayslip($staff);

        $http = $this->asUser($staff);
        $create = $http->postJson('/api/v1/finance/advances', [
            'advance_type'                  => 'medical',
            'amount'                        => $amount,
            'currency'                      => 'NAD',
            'purpose'                       => 'Medical',
            'justification'                 => 'Surgery',
            'repayment_months'              => 1,
            'deduction_authority_confirmed' => true,
        ]);
        $id = $create->json('data.id');
        $http->postJson("/api/v1/finance/advances/{$id}/submit", [
            'deduction_authority_confirmed' => true,
        ])->assertOk();

        [$finHttp] = $this->asFinanceController($tenant);
        $finHttp->postJson("/api/v1/finance/advances/{$id}/finance-certify", [
            'confirmed_net_salary'           => 10000,
            'intended_recovery_payroll_date' => '2026-07-31',
            'eligible'                       => true,
            'comments'                       => 'Certified',
        ])->assertOk();

        [$sgHttp] = $this->asSG($tenant);
        $sgHttp->postJson("/api/v1/finance/advances/{$id}/approve", [
            'comment' => 'Final approval',
        ])->assertOk();

        $finHttp->postJson("/api/v1/finance/advances/{$id}/record-payment", [
            'payment_reference' => 'PAY-P3',
            'payment_method'    => 'bank_transfer',
            'payment_date'      => '2026-07-20',
        ])->assertOk();

        return [SalaryAdvanceRequest::findOrFail($id), $staff, $finHttp];
    }

    public function test_full_recovery_files_form002_into_confidential_personnel_file(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        [$advance, $staff, $finHttp] = $this->paidAdvance($tenant);

        HrPersonalFile::create([
            'tenant_id'   => $tenant->id,
            'employee_id' => $staff->id,
            'created_by'  => $staff->id,
            'file_status' => 'active',
        ]);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount'        => 2000,
            'reference_doc' => 'PAYROLL-JUL-2026-001',
            'notes'         => 'Full EOM recovery',
        ])->assertOk()
          ->assertJsonPath('data.status', 'closed');

        $advance->refresh();
        $this->assertNotNull($advance->personnel_file_id);
        $this->assertNotNull($advance->personnel_file_document_id);

        $doc = HrFileDocument::findOrFail($advance->personnel_file_document_id);
        $this->assertSame('confidential', $doc->confidentiality_level);
        $this->assertSame('salary_advance', $doc->source_module);
        $this->assertSame('salary_advance_form_002', $doc->document_type);
        $this->assertNotEmpty($doc->file_path);
        Storage::disk('local')->assertExists($doc->file_path);

        $show = $finHttp->getJson("/api/v1/finance/advances/{$advance->id}")
            ->assertOk();
        $this->assertStringContainsString('/hr/files/', $show->json('data.personnel_file_url'));
    }

    public function test_record_recovery_requires_transaction_reference(): void
    {
        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->paidAdvance($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount' => 2000,
            'notes'  => 'Missing ref',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['reference_doc']);
    }

    public function test_payroll_integration_exposes_manual_adapter_contract(): void
    {
        $this->assertInstanceOf(
            PayrollRecoveryAdapterInterface::class,
            app(PayrollRecoveryAdapterInterface::class)
        );
        $this->assertInstanceOf(
            ManualPayrollRecoveryAdapter::class,
            app(PayrollRecoveryAdapterInterface::class)
        );

        $tenant = Tenant::factory()->create();
        [$finHttp] = $this->asFinanceController($tenant);

        $finHttp->getJson('/api/v1/finance/advances/payroll-integration')
            ->assertOk()
            ->assertJsonPath('data.mode', 'manual')
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.adapter', 'manual')
            ->assertJsonPath('data.coming_soon', false);
    }

    public function test_policy_exception_create_approve_audited_without_silent_eligibility_bypass(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->confirmedPayslip($staff);

        // Seed an outstanding advance so eligibility is blocked
        SalaryAdvanceRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $staff->id,
            'reference_number' => 'ADV-OPEN-P3',
            'advance_type'     => 'medical',
            'amount'           => 500,
            'currency'         => 'NAD',
            'repayment_months' => 1,
            'purpose'          => 'Open',
            'justification'    => 'Blocking',
            'status'           => 'paid',
            'payment_status'   => 'paid',
            'recovery_status'  => 'scheduled',
        ]);
        BalanceRegister::create([
            'tenant_id'           => $tenant->id,
            'employee_id'         => $staff->id,
            'module_type'         => 'salary_advance',
            'source_request_type' => SalaryAdvanceRequest::class,
            'source_request_id'   => SalaryAdvanceRequest::where('reference_number', 'ADV-OPEN-P3')->value('id'),
            'reference_number'    => 'ADV-OPEN-P3',
            'approved_amount'     => 500,
            'balance'             => 500,
            'status'              => 'active',
            'created_by'          => $staff->id,
        ]);

        [$adminHttp, $admin] = $this->asAdmin($tenant);
        $admin->givePermissionTo('salary_advance.admin');

        $create = $adminHttp->postJson('/api/v1/finance/advances/policy-exceptions', [
            'employee_id'     => $staff->id,
            'exception_type'  => 'outstanding_balance',
            'reason'          => 'SG approved one-off hardship exception',
            'justification'   => 'Documented SG memo 2026-07-01',
            'effective_from'  => '2026-07-01',
            'effective_to'    => '2026-12-31',
        ])->assertCreated()
          ->assertJsonPath('data.status', 'pending');

        $exceptionId = $create->json('data.id');

        $adminHttp->postJson("/api/v1/finance/advances/policy-exceptions/{$exceptionId}/approve", [
            'decision_notes' => 'Approved by SG after Finance review',
        ])->assertOk()
          ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'salary_advance.policy_exception_approved',
        ]);

        // Approved exception is visible but does NOT silently make staff eligible
        $elig = $this->asUser($staff)->getJson('/api/v1/finance/advances/eligibility')->assertOk();
        $this->assertFalse($elig->json('eligible'));
        $this->assertNotEmpty($elig->json('policy_exceptions'));
        $this->assertSame('approved', $elig->json('policy_exceptions.0.status'));
    }

    public function test_staff_cannot_create_policy_exception(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $this->asUser($staff)
            ->postJson('/api/v1/finance/advances/policy-exceptions', [
                'employee_id'    => $staff->id,
                'exception_type' => 'max_percentage',
                'reason'         => 'Please',
                'justification'  => 'Need more',
                'effective_from' => '2026-07-01',
            ])->assertForbidden();
    }

    public function test_opening_balance_artisan_command_creates_historical_closed_advance(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'sadcpf']);
        $staff = $this->makeUser('staff', $tenant);
        $staff->update(['email' => 'hist.staff@example.test']);

        $exit = Artisan::call('salary-advance:import-opening-balance', [
            'employee_email' => 'hist.staff@example.test',
            'amount'         => 1500,
            '--reference'    => 'HIST-SA-001',
            '--paid-at'      => '2025-12-15',
            '--recovered'    => true,
        ]);

        $this->assertSame(0, $exit);

        $advance = SalaryAdvanceRequest::where('reference_number', 'HIST-SA-001')->first();
        $this->assertNotNull($advance);
        $this->assertSame('closed', $advance->status);
        $this->assertSame(1500.0, (float) $advance->amount);

        $register = BalanceRegister::where('source_request_type', SalaryAdvanceRequest::class)
            ->where('source_request_id', $advance->id)
            ->first();
        $this->assertNotNull($register);
        $this->assertSame(0.0, (float) $register->balance);
        $this->assertSame('closed', $register->status);
    }
}
