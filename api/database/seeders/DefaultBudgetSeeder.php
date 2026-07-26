<?php

namespace Database\Seeders;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

class DefaultBudgetSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->first();
        if (! $tenant) {
            return;
        }

        $actor = User::query()->where('tenant_id', $tenant->id)->first();
        $fy = FinancialYear::defaultAprilMarch((int) $tenant->id, 2026);

        $core = FundingSource::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'OWN'],
            [
                'name' => 'SADC PF Own Funds',
                'type' => 'own_funds',
                'currency' => 'NAD',
                'is_active' => true,
            ]
        );

        $donor = FundingSource::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'DONOR'],
            [
                'name' => 'Donor Grant',
                'type' => 'donor_grant',
                'currency' => 'NAD',
                'is_active' => true,
            ]
        );

        $budget = Budget::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'year' => '2026',
                'name' => 'FY 2026/27 Institutional Budget',
            ],
            [
                'financial_year_id' => $fy->id,
                'type' => 'core',
                'status' => 'active',
                'currency' => 'NAD',
                'total_amount' => 0,
                'created_by' => $actor?->id,
                'description' => 'Seeded institutional budget for Phase 1 availability controls.',
            ]
        );

        $lines = [
            ['code' => 'OPS-ADMIN', 'name' => 'Operational Administration', 'category' => 'operational', 'amount' => 500000, 'source' => $core->id],
            ['code' => 'PROG-ACT', 'name' => 'Programme Activities', 'category' => 'direct_operational', 'amount' => 800000, 'source' => $core->id],
            ['code' => 'TRAVEL', 'name' => 'Travel & Missions', 'category' => 'direct_operational', 'amount' => 300000, 'source' => $core->id],
            ['code' => 'CAPEX', 'name' => 'Capital Expenditure', 'category' => 'capital', 'amount' => 200000, 'source' => $core->id],
            ['code' => 'DONOR-PROG', 'name' => 'Donor Programme Envelope', 'category' => 'programme', 'amount' => 1000000, 'source' => $donor->id],
        ];

        $total = 0;
        foreach ($lines as $row) {
            BudgetLine::query()->firstOrCreate(
                ['budget_id' => $budget->id, 'code' => $row['code']],
                [
                    'name' => $row['name'],
                    'category' => $row['category'],
                    'funding_source_id' => $row['source'],
                    'amount_allocated' => $row['amount'],
                    'original_allocation' => $row['amount'],
                    'amount_spent' => 0,
                    'is_active' => true,
                ]
            );
            $total += $row['amount'];
        }

        $budget->update(['total_amount' => $total, 'financial_year_id' => $fy->id]);
    }
}
