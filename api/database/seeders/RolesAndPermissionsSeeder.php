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
            'assets.view', 'assets.create', 'assets.edit', 'assets.dispose', 'assets.admin', 'assets.manage',
            'governance.view', 'governance.create', 'governance.approve', 'governance.admin',
            'hr.view', 'hr.create', 'hr.edit', 'hr.approve', 'hr.admin',
            // HR Settings (master data governance — restricted to HR Manager & Finance Director)
            'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
            // Programmes / PIF
            'pif.view', 'pif.create', 'pif.approve', 'pif.admin',
            // Workplan
            'workplan.view', 'workplan.create', 'workplan.approve', 'workplan.admin',
            // Assignments (Oversight & Accountability)
            'assignments.view', 'assignments.create', 'assignments.issue', 'assignments.admin',
            // Timesheets
            'timesheets.view', 'timesheets.create', 'timesheets.approve',
            // Performance Appraisals
            'appraisals.view', 'appraisals.create', 'appraisals.review', 'appraisals.admin',
            // Conduct, Discipline & Recognition
            'conduct.view', 'conduct.create', 'conduct.admin',
            // Calendar
            'calendar.view', 'calendar.create', 'calendar.admin',
            // Support Tickets
            'support.view', 'support.create', 'support.admin',
            'srhr.view', 'srhr.create', 'srhr.manage', 'srhr.admin',
            'parliaments.view', 'parliaments.manage',
            'researcher_reports.view', 'researcher_reports.submit', 'researcher_reports.acknowledge', 'researcher_reports.admin',
            'reports.view', 'reports.export', 'reports.audit',
            'audit.view', 'audit.export',
            'system.admin',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $guards = ['sanctum', 'web'];

        foreach ($guards as $guard) {
            // --- Roles (same names for both guards so syncRoles() finds them; default guard is web) ---
            $systemAdmin = Role::firstOrCreate(['name' => 'System Admin', 'guard_name' => $guard]);
            $systemAdmin->syncPermissions(Permission::where('guard_name', $guard)->get());

            $superAdmin = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => $guard]);
            $superAdmin->syncPermissions(Permission::where('guard_name', $guard)->get());

            $hrManager = Role::firstOrCreate(['name' => 'HR Manager', 'guard_name' => $guard]);
            $hrManager->syncPermissions(
                Permission::whereIn('name', [
                    'users.view', 'hr.view', 'hr.create', 'hr.edit', 'hr.approve',
                    'travel.view', 'leave.view', 'leave.approve', 'imprest.view', 'imprest.approve',
                    'governance.view',
                    'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
                ])->where('guard_name', $guard)->get()
            );

            $financeController = Role::firstOrCreate(['name' => 'Finance Controller', 'guard_name' => $guard]);
            $financeController->syncPermissions(
                Permission::whereIn('name', [
                    'finance.view', 'finance.create', 'finance.approve', 'finance.export',
                    'travel.view', 'procurement.view', 'governance.view', 'audit.view',
                    'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
                ])->where('guard_name', $guard)->get()
            );

            $procurementOfficer = Role::firstOrCreate(['name' => 'Procurement Officer', 'guard_name' => $guard]);
            $procurementOfficer->syncPermissions(
                Permission::whereIn('name', [
                    'procurement.view', 'procurement.create',
                    'assets.view', 'assets.create', 'finance.view', 'governance.view',
                ])->where('guard_name', $guard)->get()
            );

            $governanceOfficer = Role::firstOrCreate(['name' => 'Governance Officer', 'guard_name' => $guard]);
            $governanceOfficer->syncPermissions(
                Permission::whereIn('name', [
                    'governance.view', 'governance.create', 'governance.approve', 'governance.admin',
                    'reports.view', 'reports.export',
                ])->where('guard_name', $guard)->get()
            );

            $externalAuditor = Role::firstOrCreate(['name' => 'External Auditor', 'guard_name' => $guard]);
            $externalAuditor->syncPermissions(
                Permission::whereIn('name', [
                    'finance.view', 'governance.view', 'audit.view', 'audit.export',
                    'travel.view', 'assets.view', 'hr.view',
                ])->where('guard_name', $guard)->get()
            );

            $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => $guard]);
            $staff->syncPermissions(
                Permission::whereIn('name', [
                    'travel.view', 'travel.create',
                    'leave.view', 'leave.create',
                    'imprest.view', 'imprest.create',
                    'finance.view', 'finance.create',
                    'procurement.view', 'procurement.create',
                    'hr.view', 'hr.create',
                    'governance.view', 'reports.view', 'assets.view',
                ])->where('guard_name', $guard)->get()
            );

            $fieldResearcher = Role::firstOrCreate(['name' => 'Field Researcher', 'guard_name' => $guard]);
            $fieldResearcher->syncPermissions(
                Permission::whereIn('name', [
                    'researcher_reports.view', 'researcher_reports.submit',
                    'parliaments.view', 'srhr.view',
                ])->where('guard_name', $guard)->get()
            );

            // HR Administrator: manages departments, positions, HR settings, appraisals, conduct, timesheets.
            $hrAdmin = Role::firstOrCreate(['name' => 'HR Administrator', 'guard_name' => $guard]);
            $hrAdmin->syncPermissions(
                Permission::whereIn('name', [
                    'hr.view', 'hr.create', 'hr.edit', 'hr.approve', 'hr.admin',
                    'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
                    'users.view',
                    'leave.view', 'leave.approve',
                    'travel.view',
                    'timesheets.view', 'timesheets.create', 'timesheets.approve',
                    'appraisals.view', 'appraisals.create', 'appraisals.review', 'appraisals.admin',
                    'conduct.view', 'conduct.create', 'conduct.admin',
                    'governance.view',
                    'reports.view',
                ])->where('guard_name', $guard)->get()
            );

            // Secretary General: final approver; can approve after workflow steps (including own request at final step).
            $secretaryGeneral = Role::firstOrCreate(['name' => 'Secretary General', 'guard_name' => $guard]);
            $secretaryGeneral->syncPermissions(
                Permission::whereIn('name', [
                    'travel.view', 'travel.approve',
                    'leave.view', 'leave.approve',
                    'imprest.view', 'imprest.approve',
                    'procurement.view', 'procurement.approve',
                    'finance.view', 'finance.approve',
                    'governance.view', 'governance.approve',
                    'hr.view', 'hr.approve',
                    'reports.view', 'reports.export',
                    'audit.view',
                ])->where('guard_name', $guard)->get()
            );
        }
    }
}
