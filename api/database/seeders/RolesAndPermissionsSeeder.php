<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // --- Permissions (aligned with web Admin Roles UI) ---
        $permissions = [
            'users.view', 'users.create', 'users.edit', 'users.deactivate', 'users.delete',
            'roles.view', 'roles.manage',
            'travel.view', 'travel.create', 'travel.approve', 'travel.admin',
            'leave.view', 'leave.create', 'leave.approve', 'leave.admin',
            'imprest.view', 'imprest.create', 'imprest.approve', 'imprest.liquidate',
            'finance.view', 'finance.create', 'finance.approve', 'finance.export', 'finance.admin',
            'procurement.view', 'procurement.create', 'procurement.approve', 'procurement.admin',
            'assets.view', 'assets.create', 'assets.edit', 'assets.dispose', 'assets.admin',
            'governance.view', 'governance.create', 'governance.approve', 'governance.admin',
            'hr.view', 'hr.create', 'hr.edit', 'hr.approve', 'hr.admin',
            'reports.view', 'reports.export', 'reports.audit',
            'audit.view', 'audit.export',
            'system.admin',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
        }

        // --- Roles ---
        $systemAdmin = Role::firstOrCreate(['name' => 'System Admin', 'guard_name' => 'sanctum']);
        $systemAdmin->syncPermissions(Permission::all());

        $superAdmin = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'sanctum']);
        $superAdmin->syncPermissions(Permission::all());

        $hrManager = Role::firstOrCreate(['name' => 'HR Manager', 'guard_name' => 'sanctum']);
        $hrManager->syncPermissions([
            'users.view', 'hr.view', 'hr.create', 'hr.edit', 'hr.approve',
            'travel.view', 'leave.view', 'leave.approve', 'imprest.view', 'imprest.approve',
            'governance.view',
        ]);

        $financeController = Role::firstOrCreate(['name' => 'Finance Controller', 'guard_name' => 'sanctum']);
        $financeController->syncPermissions([
            'finance.view', 'finance.create', 'finance.approve', 'finance.export',
            'travel.view', 'procurement.view', 'governance.view', 'audit.view',
        ]);

        $procurementOfficer = Role::firstOrCreate(['name' => 'Procurement Officer', 'guard_name' => 'sanctum']);
        $procurementOfficer->syncPermissions([
            'procurement.view', 'procurement.create',
            'assets.view', 'assets.create', 'finance.view', 'governance.view',
        ]);

        $externalAuditor = Role::firstOrCreate(['name' => 'External Auditor', 'guard_name' => 'sanctum']);
        $externalAuditor->syncPermissions([
            'finance.view', 'governance.view', 'audit.view', 'audit.export',
            'travel.view', 'assets.view', 'hr.view',
        ]);

        // Use lowercase 'staff' to match API checks: hasRole('staff')
        $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'sanctum']);
        $staff->syncPermissions([
            'travel.view', 'travel.create',
            'leave.view', 'leave.create',
            'imprest.view', 'imprest.create',
            'finance.view', 'finance.create',
            'procurement.view', 'procurement.create',
            'hr.view', 'hr.create',
        ]);
    }
}
