<?php

namespace Tests\Feature\Leave;

use App\Models\LeaveLedgerEntry;
use App\Models\LeaveType;
use App\Models\Tenant;
use App\Modules\Leave\Services\LeavePolicyService;
use Tests\TestCase;

class LeaveMonthlyAccrualCommandTest extends TestCase
{
    public function test_monthly_annual_accrual_posts_ledger_entries_once_per_employee_and_period(): void
    {
        $tenant = Tenant::factory()->create();
        $staffA = $this->makeUser('staff', $tenant);
        $staffB = $this->makeUser('staff', $tenant);

        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        LeaveType::where('tenant_id', $tenant->id)
            ->where('code', 'annual')
            ->update([
                'accrual_rate' => 2,
                'accrual_unit' => 'monthly',
            ]);

        $this->artisan('leave:post-monthly-accruals', [
            '--tenant' => $tenant->id,
            '--month' => '2026-08',
        ])->assertExitCode(0);

        $this->assertDatabaseHas('leave_ledger_entries', [
            'tenant_id' => $tenant->id,
            'user_id' => $staffA->id,
            'leave_type' => 'annual',
            'transaction_type' => LeaveLedgerEntry::ACCRUAL,
            'amount' => '2.00',
            'effective_date' => '2026-08-31',
            'reference' => 'ANNUAL-ACCRUAL-2026-08',
        ]);
        $this->assertDatabaseHas('leave_ledger_entries', [
            'tenant_id' => $tenant->id,
            'user_id' => $staffB->id,
            'leave_type' => 'annual',
            'transaction_type' => LeaveLedgerEntry::ACCRUAL,
            'amount' => '2.00',
            'effective_date' => '2026-08-31',
            'reference' => 'ANNUAL-ACCRUAL-2026-08',
        ]);

        $this->artisan('leave:post-monthly-accruals', [
            '--tenant' => $tenant->id,
            '--month' => '2026-08',
        ])->assertExitCode(0);

        $this->assertSame(2, LeaveLedgerEntry::where('reference', 'ANNUAL-ACCRUAL-2026-08')->count());
    }

    public function test_monthly_accrual_can_derive_rate_from_configured_annual_entitlement(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        LeaveType::where('tenant_id', $tenant->id)
            ->where('code', 'annual')
            ->update(['annual_entitlement' => 24]);

        $this->artisan('leave:post-monthly-accruals', [
            '--tenant' => $tenant->id,
            '--month' => '2026-09',
        ])->assertExitCode(0);

        $this->assertDatabaseHas('leave_ledger_entries', [
            'tenant_id' => $tenant->id,
            'user_id' => $staff->id,
            'leave_type' => 'annual',
            'transaction_type' => LeaveLedgerEntry::ACCRUAL,
            'amount' => '2.00',
            'reference' => 'ANNUAL-ACCRUAL-2026-09',
        ]);
    }

    public function test_monthly_accrual_skips_when_annual_entitlement_is_not_configured(): void
    {
        $tenant = Tenant::factory()->create();
        $this->makeUser('staff', $tenant);

        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);

        $this->artisan('leave:post-monthly-accruals', [
            '--tenant' => $tenant->id,
            '--month' => '2026-10',
        ])->assertExitCode(0);

        $this->assertDatabaseMissing('leave_ledger_entries', [
            'tenant_id' => $tenant->id,
            'leave_type' => 'annual',
            'transaction_type' => LeaveLedgerEntry::ACCRUAL,
            'reference' => 'ANNUAL-ACCRUAL-2026-10',
        ]);
    }

    public function test_monthly_accrual_dry_run_does_not_write_entries(): void
    {
        $tenant = Tenant::factory()->create();
        $this->makeUser('staff', $tenant);

        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        LeaveType::where('tenant_id', $tenant->id)
            ->where('code', 'annual')
            ->update([
                'accrual_rate' => 1.75,
                'accrual_unit' => 'monthly',
            ]);

        $this->artisan('leave:post-monthly-accruals', [
            '--tenant' => $tenant->id,
            '--month' => '2026-11',
            '--dry-run' => true,
        ])->assertExitCode(0);

        $this->assertDatabaseMissing('leave_ledger_entries', [
            'tenant_id' => $tenant->id,
            'reference' => 'ANNUAL-ACCRUAL-2026-11',
        ]);
    }
}
