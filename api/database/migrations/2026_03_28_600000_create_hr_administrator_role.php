<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Creates the "HR Administrator" role responsible for managing HR administration:
 * departments, positions, HR settings, leave approvals, timesheets, appraisals,
 * conduct records, and employee files.
 */
return new class extends Migration
{
    private const ROLE_NAME = 'HR Administrator';

    private array $permissions = [
        // Core HR management
        'hr.view', 'hr.create', 'hr.edit', 'hr.approve', 'hr.admin',
        // HR Settings (master data: pay grades, leave types, allowances etc.)
        'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
        // User visibility
        'users.view',
        // Leave
        'leave.view', 'leave.approve',
        // Travel (visibility for HR purposes)
        'travel.view',
        // Timesheets
        'timesheets.view', 'timesheets.create', 'timesheets.approve',
        // Appraisals
        'appraisals.view', 'appraisals.create', 'appraisals.review', 'appraisals.admin',
        // Conduct, Discipline & Recognition
        'conduct.view', 'conduct.create', 'conduct.admin',
        // Governance (read-only)
        'governance.view',
        // Reports
        'reports.view',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::firstOrCreate(['name' => self::ROLE_NAME, 'guard_name' => $guard]);
            $role->syncPermissions(
                Permission::whereIn('name', $this->permissions)->where('guard_name', $guard)->get()
            );
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            Role::where('name', self::ROLE_NAME)->where('guard_name', $guard)->first()?->delete();
        }
    }
};
