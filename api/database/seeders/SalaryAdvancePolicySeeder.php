<?php

namespace Database\Seeders;

use App\Models\SalaryAdvancePolicyVersion;
use Illuminate\Database\Seeder;

class SalaryAdvancePolicySeeder extends Seeder
{
    public function run(): void
    {
        SalaryAdvancePolicyVersion::query()
            ->whereNull('tenant_id')
            ->where('version', '2026.1')
            ->update(['active' => false]);

        SalaryAdvancePolicyVersion::updateOrCreate(
            [
                'tenant_id' => null,
                'version'   => '2026.1',
            ],
            [
                'effective_from'                 => '2026-01-01',
                'effective_to'                   => null,
                'max_salary_percentage'          => 50,
                'salary_basis'                   => 'net_confirmed',
                'max_concurrent_advances'        => 1,
                'full_repayment_required'        => true,
                'recovery_rule'                  => 'full_eom',
                'final_approver_role'            => 'Secretary General',
                'finance_certification_required' => true,
                'admin_review_required'          => true,
                'configuration'                  => [
                    'consolidation_enabled' => false,
                    'instalments_enabled'   => false,
                    'parallel_advances'     => false,
                ],
                'approved_by'                    => null,
                'active'                         => true,
            ]
        );
    }
}
