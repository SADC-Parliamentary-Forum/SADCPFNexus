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
    /**
     * Seed demo users for the default tenant. Depends on TenantSeeder, RolesAndPermissionsSeeder, DepartmentsSeeder.
     * Passwords are documented in README for dev/demo only.
     */
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $itDept   = Department::where('tenant_id', $tenant->id)->where('code', 'IT')->first();
        $hrDept   = Department::where('tenant_id', $tenant->id)->where('code', 'HR')->first();
        $finDept  = Department::where('tenant_id', $tenant->id)->where('code', 'FIN')->first();
        $procDept = Department::where('tenant_id', $tenant->id)->where('code', 'PROC')->first();
        $secDept  = Department::where('tenant_id', $tenant->id)->where('code', 'SEC')->first();
        $govDept  = Department::where('tenant_id', $tenant->id)->where('code', 'GOV')->first();

        $systemAdminRole = Role::where('name', 'System Admin')->where('guard_name', 'sanctum')->first();
        $staffRole      = Role::where('name', 'staff')->where('guard_name', 'sanctum')->first();
        $hrManagerRole  = Role::where('name', 'HR Manager')->where('guard_name', 'sanctum')->first();
        $financeRole    = Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $procurementRole = Role::where('name', 'Procurement Officer')->where('guard_name', 'sanctum')->first();
        $sgRole         = Role::where('name', 'Secretary General')->where('guard_name', 'sanctum')->first();

        if (! $systemAdminRole || ! $staffRole) {
            return;
        }

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
        $admin->syncRoles([$systemAdminRole]);

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
        $staffUser->syncRoles([$staffRole]);

        if ($hrManagerRole) {
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
            $hrUser->syncRoles([$hrManagerRole]);
        }

        if ($financeRole) {
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
            $financeUser->syncRoles([$financeRole]);
        }

        if ($secDept) {
            $mariaUser = User::firstOrCreate(
                ['email' => 'maria@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $secDept->id,
                    'name'            => 'Maria Dlamini',
                    'password'        => Hash::make('Maria@2024!'),
                    'employee_number' => 'SADCPF-005',
                    'job_title'       => 'Senior Programme Officer',
                    'classification'  => 'CONFIDENTIAL',
                    'is_active'       => true,
                ]
            );
            $mariaUser->syncRoles([$staffRole]);
        }

        if ($procDept && $procurementRole) {
            $johnUser = User::firstOrCreate(
                ['email' => 'john@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $procDept->id,
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

        if ($govDept) {
            $thaboUser = User::firstOrCreate(
                ['email' => 'thabo@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $govDept->id,
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

        if ($sgRole && $secDept) {
            User::firstOrCreate(
                ['email' => 'sg@sadcpf.org'],
                [
                    'tenant_id'       => $tenant->id,
                    'department_id'   => $secDept->id,
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
