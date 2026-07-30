<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissions = [
        'notifications.view-own',
        'notifications.manage-own-preferences',
        'notifications.acknowledge',
        'notifications.view-delivery-status',
        'notifications.manage-templates',
        'notifications.approve-templates',
        'notifications.manage-policies',
        'notifications.send-broadcast',
        'notifications.approve-broadcast',
        'notifications.retry',
        'notifications.suppress',
        'notifications.manage-providers',
        'notifications.view-failures',
        'notifications.view-audit',
        'notifications.export',
        'notifications.admin',
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

            $staffPerms = [
                'notifications.view-own',
                'notifications.manage-own-preferences',
                'notifications.acknowledge',
            ];
            foreach (['staff', 'Staff'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo(
                        Permission::whereIn('name', $staffPerms)->where('guard_name', $guard)->get()
                    );
                }
            }

            $adminOps = Permission::whereIn('name', [
                'notifications.manage-templates',
                'notifications.approve-templates',
                'notifications.manage-policies',
                'notifications.retry',
                'notifications.suppress',
                'notifications.view-failures',
                'notifications.view-audit',
                'notifications.view-delivery-status',
                'notifications.admin',
            ])->where('guard_name', $guard)->get();

            foreach (['HR Manager', 'Secretary General'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo($adminOps);
                }
            }
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::whereIn('name', $this->permissions)->delete();
    }
};
