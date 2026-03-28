<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Creates the "SRHR Researcher" role for field researchers deployed at member state parliaments.
 * These staff are paid by SADC-PF but supervised locally; their leave and timesheets are
 * managed by the host parliament, not SADC-PF. They submit periodic activity reports.
 *
 * Also grants SRHR management permissions to HR Manager and HR Administrator roles.
 */
return new class extends Migration
{
    private array $newPermissions = [
        'srhr.view',
        'srhr.create',
        'srhr.manage',
        'srhr.admin',
        'parliaments.view',
        'parliaments.manage',
        'researcher_reports.view',
        'researcher_reports.submit',
        'researcher_reports.acknowledge',
        'researcher_reports.admin',
    ];

    /** Permissions assigned to the new SRHR Researcher role */
    private array $researcherPermissions = [
        'travel.view',
        'travel.create',
        'finance.view',
        'researcher_reports.view',
        'researcher_reports.submit',
        'hr.view',
        'pif.view',
    ];

    /** Additional permissions granted to existing HR roles */
    private array $hrRoleExtensions = [
        'srhr.view',
        'srhr.manage',
        'parliaments.view',
        'parliaments.manage',
        'researcher_reports.view',
        'researcher_reports.acknowledge',
        'researcher_reports.admin',
    ];

    /** Additional permissions granted to Secretary General */
    private array $sgExtensions = [
        'srhr.view',
        'researcher_reports.view',
        'researcher_reports.acknowledge',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            // Create new permissions
            foreach ($this->newPermissions as $perm) {
                Permission::firstOrCreate(['name' => $perm, 'guard_name' => $guard]);
            }

            // Create SRHR Researcher role
            $researcherRole = Role::firstOrCreate(['name' => 'SRHR Researcher', 'guard_name' => $guard]);
            $researcherRole->syncPermissions(
                Permission::whereIn('name', $this->researcherPermissions)->where('guard_name', $guard)->get()
            );

            // Extend HR Manager
            $hrManager = Role::where('name', 'HR Manager')->where('guard_name', $guard)->first();
            if ($hrManager) {
                $hrManager->givePermissionTo(
                    Permission::whereIn('name', $this->hrRoleExtensions)->where('guard_name', $guard)->get()
                );
            }

            // Extend HR Administrator
            $hrAdmin = Role::where('name', 'HR Administrator')->where('guard_name', $guard)->first();
            if ($hrAdmin) {
                $hrAdmin->givePermissionTo(
                    Permission::whereIn('name', $this->hrRoleExtensions)->where('guard_name', $guard)->get()
                );
            }

            // Extend Secretary General
            $sg = Role::where('name', 'Secretary General')->where('guard_name', $guard)->first();
            if ($sg) {
                $sg->givePermissionTo(
                    Permission::whereIn('name', $this->sgExtensions)->where('guard_name', $guard)->get()
                );
            }
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            Role::where('name', 'SRHR Researcher')->where('guard_name', $guard)->first()?->delete();

            foreach ($this->newPermissions as $perm) {
                Permission::where('name', $perm)->where('guard_name', $guard)->first()?->delete();
            }
        }
    }
};
