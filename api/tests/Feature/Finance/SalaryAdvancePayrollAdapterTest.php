<?php

namespace Tests\Feature\Finance;

use App\Models\Payslip;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface;
use App\Modules\Finance\Services\ManualPayrollRecoveryAdapter;
use App\Modules\Finance\Services\NullPayrollRecoveryAdapter;
use App\Modules\Finance\Services\PayrollRecoveryAdapterFactory;
use InvalidArgumentException;
use Tests\TestCase;

class SalaryAdvancePayrollAdapterTest extends TestCase
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
            'payment_reference' => 'PAY-ADAPTER',
            'payment_method'    => 'bank_transfer',
            'payment_date'      => '2026-07-20',
        ])->assertOk();

        return [SalaryAdvanceRequest::findOrFail($id), $staff, $finHttp];
    }

    public function test_default_driver_binds_manual_adapter(): void
    {
        config(['salary_advance.payroll_recovery_driver' => 'manual']);

        $adapter = app(PayrollRecoveryAdapterInterface::class);

        $this->assertInstanceOf(ManualPayrollRecoveryAdapter::class, $adapter);
        $this->assertSame('manual', $adapter->adapterKey());
        $this->assertFalse($adapter->isEnabled());
        $this->assertSame('manual_reference_required', $adapter->status()['recording_mode']);
    }

    public function test_manual_schedule_and_record_recovery_path(): void
    {
        config(['salary_advance.payroll_recovery_driver' => 'manual']);

        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->paidAdvance($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/schedule-recovery", [
            'intended_recovery_payroll_date' => '2026-08-31',
        ])->assertOk()
          ->assertJsonPath('data.status', 'recovery_scheduled');

        $advance->refresh();
        $this->assertSame('2026-08-31', $advance->intended_recovery_payroll_date?->toDateString());

        $adapter = app(PayrollRecoveryAdapterInterface::class);
        $status = $adapter->queryStatus($advance->fresh(['balanceRegister']));
        $this->assertSame('manual', $status['adapter']);
        $this->assertSame('scheduled', $status['recovery_status']);
        $this->assertNull($status['vendor_status']);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount'        => 2000,
            'reference_doc' => 'PAYROLL-AUG-001',
        ])->assertOk()
          ->assertJsonPath('data.status', 'closed');

        $finHttp->getJson('/api/v1/finance/advances/payroll-integration')
            ->assertOk()
            ->assertJsonPath('data.mode', 'manual')
            ->assertJsonPath('data.driver', 'manual')
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.recording_mode', 'manual_reference_required');
    }

    public function test_manual_record_still_requires_transaction_reference(): void
    {
        config(['salary_advance.payroll_recovery_driver' => 'manual']);

        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->paidAdvance($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount' => 2000,
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['reference_doc']);
    }

    public function test_null_and_disabled_drivers_bind_null_adapter_and_block_record(): void
    {
        $factory = app(PayrollRecoveryAdapterFactory::class);

        foreach (['null', 'disabled'] as $driver) {
            $adapter = $factory->make($driver);
            $this->assertInstanceOf(NullPayrollRecoveryAdapter::class, $adapter);
            $this->assertSame('disabled', $adapter->mode());
            $this->assertFalse($adapter->isEnabled());
        }

        config(['salary_advance.payroll_recovery_driver' => 'disabled']);
        $this->app->forgetInstance(PayrollRecoveryAdapterInterface::class);
        $this->app->offsetUnset(PayrollRecoveryAdapterInterface::class);
        $this->app->bind(PayrollRecoveryAdapterInterface::class, function ($app) {
            return $app->make(PayrollRecoveryAdapterFactory::class)->make();
        });

        $tenant = Tenant::factory()->create();
        [$advance, , $finHttp] = $this->paidAdvance($tenant);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/schedule-recovery", [
            'intended_recovery_payroll_date' => '2026-08-31',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['adapter']);

        $finHttp->postJson("/api/v1/finance/advances/{$advance->id}/record-recovery", [
            'amount'        => 2000,
            'reference_doc' => 'SHOULD-NOT-WORK',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['adapter']);
    }

    public function test_unknown_driver_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown salary advance payroll recovery driver');

        app(PayrollRecoveryAdapterFactory::class)->make('acme-payroll');
    }

    public function test_vendor_driver_without_class_is_rejected(): void
    {
        config([
            'salary_advance.payroll_recovery_driver' => 'vendor',
            'salary_advance.payroll_vendor_class'    => null,
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Payroll driver [vendor] is not configured');

        app(PayrollRecoveryAdapterFactory::class)->make('vendor');
    }

    public function test_vendor_driver_with_missing_class_is_rejected(): void
    {
        config([
            'salary_advance.payroll_vendor_class' => 'App\\Modules\\Finance\\Services\\DoesNotExistVendorAdapter',
        ]);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('does not exist');

        app(PayrollRecoveryAdapterFactory::class)->make('vendor');
    }

    public function test_vendor_driver_rejects_non_interface_class(): void
    {
        config([
            'salary_advance.payroll_vendor_class' => \stdClass::class,
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('must implement PayrollRecoveryAdapterInterface');

        app(PayrollRecoveryAdapterFactory::class)->make('vendor');
    }
}
