<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class DepartmentsSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $departments = [
            ['name' => 'Office of the Secretary General', 'code' => 'OSG'],
            ['name' => 'Parliamentary Business',          'code' => 'PB'],
            ['name' => 'Finance and Corporate Services',  'code' => 'FCS'],
        ];

        foreach ($departments as $dept) {
            Department::updateOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $dept['code']],
                ['name' => $dept['name']]
            );
        }
    }
}
