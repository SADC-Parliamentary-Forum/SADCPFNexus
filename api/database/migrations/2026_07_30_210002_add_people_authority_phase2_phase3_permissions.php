<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissions = [
        'people.certificate.enrol',
        'people.esign.manage',
        'people.m365.sync',
        'people.recertification.manage',
        'people.sod.analyse',
        'people.org-scenarios.manage',
        'people.payroll-link.manage',
        'people.signatures.publish-verify',
        'people.succession.manage',
        'people.skills.manage',
        'people.analytics.view',
        'people.ai.suggest',
        'people.ai.apply',
        'people.privilege-alerts.manage',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            foreach ($this->permissions as $name) {
                Permission::firstOrCreate(['name' => $name, 'guard_name' => $guard]);
            }

            $all = Permission::whereIn('name', $this->permissions)->where('guard_name', $guard)->get();

            foreach (['System Admin', 'super-admin'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo($all);
                }
            }

            $hr = Role::where('name', 'HR Manager')->where('guard_name', $guard)->first();
            if ($hr) {
                $hr->givePermissionTo($all);
            }

            $sg = Role::where('name', 'Secretary General')->where('guard_name', $guard)->first();
            if ($sg) {
                $sg->givePermissionTo(Permission::whereIn('name', [
                    'people.sod.analyse',
                    'people.org-scenarios.manage',
                    'people.succession.manage',
                    'people.analytics.view',
                    'people.privilege-alerts.manage',
                    'people.ai.suggest',
                ])->where('guard_name', $guard)->get());
            }
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::whereIn('name', $this->permissions)->delete();
    }
};
