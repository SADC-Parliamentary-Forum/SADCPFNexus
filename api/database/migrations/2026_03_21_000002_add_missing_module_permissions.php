<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    private array $newPermissions = [
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
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach ($this->newPermissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // Grant app_user access to the already-granted permissions table (rows inserted here)
        // No extra DB grants needed — the table-level grant was done in the prior migration.
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach ($this->newPermissions as $perm) {
            Permission::where('name', $perm)->delete();
        }
    }
};
