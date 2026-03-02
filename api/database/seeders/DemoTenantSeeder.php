<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoTenantSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'sadcpf'],
            [
                'name'      => 'SADC Parliamentary Forum',
                'domain'    => 'sadcpf.org',
                'is_active' => true,
            ]
        );

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

        $itDept = Department::where('tenant_id', $tenant->id)->where('code', 'IT')->first();

        // Super admin user
        $admin = User::firstOrCreate(
            ['email' => 'admin@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $itDept?->id,
                'name'            => 'System Administrator',
                'password'        => Hash::make('Admin@2024!'),
                'employee_number' => 'SADCPF-001',
                'job_title'       => 'System Administrator',
                'classification'  => 'SECRET',
                'mfa_enabled'     => true,
                'is_active'       => true,
            ]
        );

        $admin->syncRoles(['System Admin']);

        $hrDept = Department::where('tenant_id', $tenant->id)->where('code', 'HR')->first();
        $finDept = Department::where('tenant_id', $tenant->id)->where('code', 'FIN')->first();
        $procDept = Department::where('tenant_id', $tenant->id)->where('code', 'PROC')->first();

        $staffUser = User::firstOrCreate(
            ['email' => 'staff@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $hrDept?->id ?? $itDept?->id,
                'name'            => 'Demo Staff',
                'password'        => Hash::make('Staff@2024!'),
                'employee_number' => 'SADCPF-002',
                'job_title'       => 'Programme Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $staffUser->syncRoles(['staff']);

        $hrUser = User::firstOrCreate(
            ['email' => 'hr@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $hrDept?->id,
                'name'            => 'HR Manager',
                'password'        => Hash::make('HR@2024!'),
                'employee_number' => 'SADCPF-003',
                'job_title'       => 'HR Manager',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $hrUser->syncRoles(['HR Manager']);

        $financeUser = User::firstOrCreate(
            ['email' => 'finance@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $finDept?->id,
                'name'            => 'Finance Controller',
                'password'        => Hash::make('Finance@2024!'),
                'employee_number' => 'SADCPF-004',
                'job_title'       => 'Finance Controller',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $financeUser->syncRoles(['Finance Controller']);
    }
}
