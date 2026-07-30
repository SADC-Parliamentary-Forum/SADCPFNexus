<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissions = [
        'notifications.ack-campaigns.manage',
        'notifications.ack-campaigns.view',
        'notifications.broadcasts.manage',
        'notifications.maintenance.manage',
        'notifications.analytics',
        'notifications.external-portal.issue',
        'notifications.ai.suggest',
        'notifications.ai.apply',
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

            $ops = Permission::whereIn('name', [
                'notifications.ack-campaigns.manage',
                'notifications.ack-campaigns.view',
                'notifications.broadcasts.manage',
                'notifications.maintenance.manage',
                'notifications.analytics',
                'notifications.external-portal.issue',
                'notifications.ai.suggest',
            ])->where('guard_name', $guard)->get();

            foreach (['HR Manager', 'Secretary General'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo($ops);
                }
            }

            // Re-assert Phase 1 broadcast permissions for admins
            foreach (['System Admin', 'super-admin', 'Secretary General'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo(
                        Permission::whereIn('name', [
                            'notifications.send-broadcast',
                            'notifications.approve-broadcast',
                        ])->where('guard_name', $guard)->get()
                    );
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
