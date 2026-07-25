<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            $permission = Permission::firstOrCreate([
                'name'       => 'workplan.external',
                'guard_name' => $guard,
            ]);

            // System Admin already syncs all permissions on full seed; ensure existing
            // production roles pick up the new permission without a full reseed.
            $admin = Role::where('name', 'System Admin')->where('guard_name', $guard)->first();
            if ($admin && ! $admin->hasPermissionTo($permission)) {
                $admin->givePermissionTo($permission);
            }

            $super = Role::where('name', 'super-admin')->where('guard_name', $guard)->first();
            if ($super && ! $super->hasPermissionTo($permission)) {
                $super->givePermissionTo($permission);
            }
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        Permission::where('name', 'workplan.external')->delete();
    }
};
