<?php
namespace Database\Seeders;
use App\Models\Portfolio;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class PortfolioSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::first();
        if (!$tenant) return;

        $portfolios = [
            ['name' => 'Governance & Democracy', 'description' => 'Parliamentary governance, democratic processes and electoral matters.', 'color' => '#1d85ed'],
            ['name' => 'Finance & Budget', 'description' => 'Financial oversight, budget analysis and fiscal accountability.', 'color' => '#16a34a'],
            ['name' => 'Peace & Security', 'description' => 'Regional peace initiatives, conflict resolution and security cooperation.', 'color' => '#dc2626'],
            ['name' => 'Regional Integration', 'description' => 'SADC regional cooperation, trade and economic integration.', 'color' => '#7c3aed'],
            ['name' => 'Gender & Development', 'description' => 'Gender equality, womens empowerment and social development.', 'color' => '#db2777'],
            ['name' => 'Legal Affairs', 'description' => 'Legislative drafting, legal compliance and constitutional matters.', 'color' => '#d97706'],
            ['name' => 'Environmental Affairs', 'description' => 'Climate change, natural resources and environmental policy.', 'color' => '#0891b2'],
            ['name' => 'Public Administration', 'description' => 'Public service delivery, institutional capacity and administration.', 'color' => '#6366f1'],
        ];

        foreach ($portfolios as $data) {
            Portfolio::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $data['name']],
                array_merge($data, ['tenant_id' => $tenant->id])
            );
        }
    }
}
