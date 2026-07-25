<?php

namespace Tests\Feature\Finance;

use App\Models\SalaryAdvancePolicyVersion;
use Database\Seeders\SalaryAdvancePolicySeeder;
use Tests\TestCase;

class SalaryAdvancePolicyTest extends TestCase
{
    public function test_active_policy_v1_seeded(): void
    {
        $this->seed(SalaryAdvancePolicySeeder::class);

        $p = SalaryAdvancePolicyVersion::query()->where('active', true)->first();

        $this->assertNotNull($p);
        $this->assertEquals(50, (float) $p->max_salary_percentage);
        $this->assertEquals(1, (int) $p->max_concurrent_advances);
        $this->assertTrue((bool) $p->full_repayment_required);
        $this->assertEquals('full_eom', $p->recovery_rule);
        $this->assertEquals('net_confirmed', $p->salary_basis);
        $this->assertTrue((bool) $p->admin_review_required);
        $this->assertTrue((bool) $p->finance_certification_required);
        $this->assertEquals('Secretary General', $p->final_approver_role);
    }
}
