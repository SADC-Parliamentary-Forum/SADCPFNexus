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
                'mfa_enabled'     => false,
                'is_active'       => true,
            ]
        );

        $adminRole = \Spatie\Permission\Models\Role::findByName('System Admin', 'sanctum');
        $admin->syncRoles([$adminRole]);

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
        $staffRole = \Spatie\Permission\Models\Role::findByName('staff', 'sanctum');
        $staffUser->syncRoles([$staffRole]);

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
        $hrManagerRole = \Spatie\Permission\Models\Role::findByName('HR Manager', 'sanctum');
        $hrUser->syncRoles([$hrManagerRole]);

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
        $financeControllerRole = \Spatie\Permission\Models\Role::findByName('Finance Controller', 'sanctum');
        $financeUser->syncRoles([$financeControllerRole]);

        $secDept  = Department::where('tenant_id', $tenant->id)->where('code', 'SEC')->first();
        $govDept  = Department::where('tenant_id', $tenant->id)->where('code', 'GOV')->first();

        $mariaUser = User::firstOrCreate(
            ['email' => 'maria@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $secDept?->id,
                'name'            => 'Maria Dlamini',
                'password'        => Hash::make('Maria@2024!'),
                'employee_number' => 'SADCPF-005',
                'job_title'       => 'Senior Programme Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $mariaUser->syncRoles([$staffRole]);

        $johnUser = User::firstOrCreate(
            ['email' => 'john@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $procDept?->id,
                'name'            => 'John Mutamba',
                'password'        => Hash::make('John@2024!'),
                'employee_number' => 'SADCPF-006',
                'job_title'       => 'Procurement Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $johnUser->syncRoles([$staffRole]);

        $thaboUser = User::firstOrCreate(
            ['email' => 'thabo@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $govDept?->id,
                'name'            => 'Thabo Nkosi',
                'password'        => Hash::make('Thabo@2024!'),
                'employee_number' => 'SADCPF-007',
                'job_title'       => 'Governance Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $thaboUser->syncRoles([$staffRole]);
    }
}
