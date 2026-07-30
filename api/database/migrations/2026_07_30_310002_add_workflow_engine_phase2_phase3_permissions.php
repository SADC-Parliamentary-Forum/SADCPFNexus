<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissions = [
        'workflows.simulate',
        'workflows.design',
        'workflows.analytics',
        'workflows.external-approve',
        'workflows.governance-record',
        'workflows.ai.suggest',
        'workflows.ai.apply',
        'workflows.calendars.manage',
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

            $sg = Role::where('name', 'Secretary General')->where('guard_name', $guard)->first();
            if ($sg) {
                $sg->givePermissionTo(Permission::whereIn('name', [
                    'workflows.simulate',
                    'workflows.analytics',
                    'workflows.governance-record',
                    'workflows.ai.suggest',
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
