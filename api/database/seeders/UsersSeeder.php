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
        $hrAdminRole      = Role::where('name', 'HR Administrator')->where('guard_name', 'sanctum')->first();
        $financeRole      = Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $procurementRole  = Role::where('name', 'Procurement Officer')->where('guard_name', 'sanctum')->first();
        $govRole          = Role::where('name', 'Governance Officer')->where('guard_name', 'sanctum')->first();
        $sgRole           = Role::where('name', 'Secretary General')->where('guard_name', 'sanctum')->first();

        if (! $systemAdminRole || ! $staffRole) {
            return;
        }

        // System Admin
        $admin = $this->upsertUser('admin@sadcpf.org', 'SADCPF-001', [
            'tenant_id'       => $tenant->id,
            'department_id'   => $osgDept?->id,
            'name'            => 'System Administrator',
            'password'        => Hash::make('Admin@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
            'job_title'       => 'System Administrator',
            'classification'  => 'SECRET',
            'mfa_enabled'     => false,
            'is_active'       => true,
        ]);
        $admin->syncRoles([$systemAdminRole]);

        // Staff / Programme Officer
        $staffUser = $this->upsertUser('staff@sadcpf.org', 'SADCPF-002', [
            'tenant_id'       => $tenant->id,
            'department_id'   => $pbDept?->id,
            'name'            => 'Demo Staff',
            'password'        => Hash::make('Staff@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
            'job_title'       => 'Programme Officer',
            'classification'  => 'CONFIDENTIAL',
            'is_active'       => true,
        ]);
        $staffUser->syncRoles([$staffRole]);

        // HR Manager
        if ($hrManagerRole) {
            $hrUser = $this->upsertUser('hr@sadcpf.org', 'SADCPF-003', [
                'tenant_id'       => $tenant->id,
                'department_id'   => $fcsDept?->id,
                'name'            => 'HR Manager',
                'password'        => Hash::make('HR@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
                'job_title'       => 'HR Manager',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]);
            $hrUser->syncRoles([$hrManagerRole]);
        }

        // Finance Controller
        if ($financeRole) {
            $financeUser = $this->upsertUser('finance@sadcpf.org', 'SADCPF-004', [
                'tenant_id'       => $tenant->id,
                'department_id'   => $fcsDept?->id,
                'name'            => 'Finance Controller',
                'password'        => Hash::make('Finance@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
                'job_title'       => 'Finance Controller',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]);
            $financeUser->syncRoles([$financeRole]);
        }

        // Senior Programme Officer
        $mariaUser = $this->upsertUser('maria@sadcpf.org', 'SADCPF-005', [
            'tenant_id'       => $tenant->id,
            'department_id'   => $pbDept?->id,
            'name'            => 'Maria Dlamini',
            'password'        => Hash::make('Maria@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
            'job_title'       => 'Senior Programme Officer',
            'classification'  => 'CONFIDENTIAL',
            'is_active'       => true,
        ]);
        $mariaUser->syncRoles([$staffRole]);

        // Procurement Officer
        if ($procurementRole) {
            $johnUser = $this->upsertUser('john@sadcpf.org', 'SADCPF-006', [
                'tenant_id'       => $tenant->id,
                'department_id'   => $fcsDept?->id,
                'name'            => 'John Mutamba',
                'password'        => Hash::make('John@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
                'job_title'       => 'Procurement Officer',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ]);
            $johnUser->syncRoles([$procurementRole]);
        }

        // Governance Officer
        $thaboUser = $this->upsertUser('thabo@sadcpf.org', 'SADCPF-007', [
            'tenant_id'       => $tenant->id,
            'department_id'   => $pbDept?->id,
            'name'            => 'Thabo Nkosi',
            'password'        => Hash::make('Thabo@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
            'job_title'       => 'Governance Officer',
            'classification'  => 'CONFIDENTIAL',
            'is_active'       => true,
        ]);
        $thaboUser->syncRoles([$staffRole]);

        // HR Administrator
        if ($hrAdminRole) {
            $this->upsertUser('hradmin@sadcpf.org', 'SADCPF-008', [
                'tenant_id'       => $tenant->id,
                'department_id'   => $fcsDept?->id,
                'name'            => 'HR Administrator',
                'password'        => Hash::make('HRAdmin@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
                'job_title'       => 'HR Administration Manager',
                'classification'  => 'CONFIDENTIAL',
                'is_active'       => true,
            ])->syncRoles([$hrAdminRole]);
        }

        // Governance Officer (Thabo)
        if ($govRole) {
            $thaboUser->syncRoles([$staffRole, $govRole]);
        }

        // Secretary General
        if ($sgRole) {
            $this->upsertUser('sg@sadcpf.org', 'SADCPF-000', [
                'tenant_id'       => $tenant->id,
                'department_id'   => $osgDept?->id,
                'name'            => 'Secretary General',
                'password'        => Hash::make('SG@2024!', ['rounds' => (int) env('BCRYPT_ROUNDS', 12)]),
                'job_title'       => 'Secretary General',
                'classification'  => 'SECRET',
                'is_active'       => true,
            ])->syncRoles([$sgRole]);
        }
    }

    /**
     * Idempotent user upsert that matches on EITHER email OR employee_number.
     *
     * Plain firstOrCreate(['email' => ...]) is unsafe because the users table also
     * has a unique constraint on employee_number — a prior partial seed (or manual
     * row) with one key but a different value for the other will cause subsequent
     * runs to hit a UniqueConstraintViolationException and abort the seeder.
     *
     * Strategy:
     *   1. Look up by email OR employee_number (covers both unique keys).
     *   2. If found, leave the row's password/classification untouched (do not
     *      overwrite operator-changed credentials) and just refresh the contact
     *      attributes that are safe to reconcile.
     *   3. If not found, create with the canonical seed values.
     */
    private function upsertUser(string $email, string $employeeNumber, array $attributes): User
    {
        $user = User::where('email', $email)
            ->orWhere('employee_number', $employeeNumber)
            ->first();

        if ($user) {
            // Reconcile the keys so future lookups are stable; never overwrite password.
            $user->fill([
                'email'           => $email,
                'employee_number' => $employeeNumber,
                'tenant_id'       => $attributes['tenant_id']     ?? $user->tenant_id,
                'department_id'   => $attributes['department_id'] ?? $user->department_id,
                'name'            => $attributes['name']          ?? $user->name,
                'job_title'       => $attributes['job_title']     ?? $user->job_title,
                'classification'  => $attributes['classification']?? $user->classification,
                'is_active'       => $attributes['is_active']     ?? $user->is_active,
            ])->save();

            return $user;
        }

        return User::create(array_merge($attributes, [
            'email'           => $email,
            'employee_number' => $employeeNumber,
        ]));
    }
}
