<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $osgDept  = Department::where('tenant_id', $tenant->id)->where('code', 'OSG')->first();
        $pbDept   = Department::where('tenant_id', $tenant->id)->where('code', 'PB')->first();
        $fcsDept  = Department::where('tenant_id', $tenant->id)->where('code', 'FCS')->first();

        $systemAdminRole  = Role::where('name', 'System Admin')->where('guard_name', 'sanctum')->first();
        $staffRole        = Role::where('name', 'staff')->where('guard_name', 'sanctum')->first();
        $hrManagerRole    = Role::where('name', 'HR Manager')->where('guard_name', 'sanctum')->first();
        $financeRole      = Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $procurementRole  = Role::where('name', 'Procurement Officer')->where('guard_name', 'sanctum')->first();
        $sgRole           = Role::where('name', 'Secretary General')->where('guard_name', 'sanctum')->first();

        if (! $systemAdminRole || ! $staffRole) {
            return;
        }

        // System Admin
        $admin = User::firstOrCreate(
            ['email' => 'admin@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $osgDept?->id,
                'name'            => 'System Administrator',
                'password'        => Hash::make('Admin@2024!'),
                'employee_number' => 'SADCPF-001',
                'job_title'       => 'System Administrator',
                'classification'  => 'SECRET',
                'mfa_enabled'     => true,
                'is_active'       => true,
            ]
        );
        $admin->syncRoles([$systemAdminRole]);

        // Staff / Programme Officer
        $staffUser = User::firstOrCreate(
            ['email' => 'staff@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $pbDept?->id,
                'name'            => 'Demo Staff',
                'password'        => Hash::make('Staff@2024!'),
                'employee_number' => 'SADCPF-002',
                'job_title'       => 'Programme Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $staffUser->syncRoles([$staffRole]);

        // HR Manager
        if ($hrManagerRole) {
            $hrUser = User::firstOrCreate(
                ['email' => 'hr@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $fcsDept?->id,
                    'name'            => 'HR Manager',
                    'password'        => Hash::make('HR@2024!'),
                    'employee_number' => 'SADCPF-003',
                    'job_title'       => 'HR Manager',
                    'classification'  => 'CONFIDENTIAL',
                    'is_active'       => true,
                ]
            );
            $hrUser->syncRoles([$hrManagerRole]);
        }

        // Finance Controller
        if ($financeRole) {
            $financeUser = User::firstOrCreate(
                ['email' => 'finance@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $fcsDept?->id,
                    'name'            => 'Finance Controller',
                    'password'        => Hash::make('Finance@2024!'),
                    'employee_number' => 'SADCPF-004',
                    'job_title'       => 'Finance Controller',
                    'classification'  => 'CONFIDENTIAL',
                    'is_active'       => true,
                ]
            );
            $financeUser->syncRoles([$financeRole]);
        }

        // Senior Programme Officer
        $mariaUser = User::firstOrCreate(
            ['email' => 'maria@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $pbDept?->id,
                'name'            => 'Maria Dlamini',
                'password'        => Hash::make('Maria@2024!'),
                'employee_number' => 'SADCPF-005',
                'job_title'       => 'Senior Programme Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $mariaUser->syncRoles([$staffRole]);

        // Procurement Officer
        if ($procurementRole) {
            $johnUser = User::firstOrCreate(
                ['email' => 'john@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $fcsDept?->id,
                    'name'            => 'John Mutamba',
                    'password'        => Hash::make('John@2024!'),
                    'employee_number' => 'SADCPF-006',
                    'job_title'       => 'Procurement Officer',
                    'classification'  => 'CONFIDENTIAL',
                    'is_active'       => true,
                ]
            );
            $johnUser->syncRoles([$procurementRole]);
        }

        // Governance Officer
        $thaboUser = User::firstOrCreate(
            ['email' => 'thabo@sadcpf.org'],
            [
                'tenant_id'       => $tenant->id,
                'department_id'   => $pbDept?->id,
                'name'            => 'Thabo Nkosi',
                'password'        => Hash::make('Thabo@2024!'),
                'employee_number' => 'SADCPF-007',
                'job_title'       => 'Governance Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]
        );
        $thaboUser->syncRoles([$staffRole]);

        // Secretary General
        if ($sgRole) {
            User::firstOrCreate(
                ['email' => 'sg@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $osgDept?->id,
                    'name'            => 'Secretary General',
                    'password'        => Hash::make('SG@2024!'),
                    'employee_number' => 'SADCPF-000',
                    'job_title'       => 'Secretary General',
                    'classification'  => 'SECRET',
                    'is_active'       => true,
                ]
            )->syncRoles([$sgRole]);
        }
    }
}
