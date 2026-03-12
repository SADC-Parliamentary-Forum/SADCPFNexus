<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class DepartmentsSeeder extends Seeder
{
    /**
     * Seed departments for the demo tenant. Depends on TenantSeeder.
     */
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $departments = [
            ['name' => 'Secretariat',        'code' => 'SEC'],
            ['name' => 'Finance & Auditing', 'code' => 'FIN'],
            ['name' => 'Human Resources',    'code' => 'HR'],
            ['name' => 'IT Operations',      'code' => 'IT'],
            ['name' => 'Procurement',        'code' => 'PROC'],
            ['name' => 'Legal',              'code' => 'LEG'],
            ['name' => 'Governance',         'code' => 'GOV'],
        ];

        foreach ($departments as $dept) {
            Department::firstOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $dept['code']],
                ['name' => $dept['name']]
            );
        }
    }
}
