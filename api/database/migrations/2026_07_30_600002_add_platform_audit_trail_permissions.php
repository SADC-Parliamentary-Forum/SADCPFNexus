<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    private array $permissions = [
        'audit-trail.view-own-records',
        'audit-trail.view-record-history',
        'audit-trail.view-department',
        'audit-trail.view-module',
        'audit-trail.view-security',
        'audit-trail.view-privileged',
        'audit-trail.view-confidential',
        'audit-trail.search',
        'audit-trail.export',
        'audit-trail.create-forensic-case',
        'audit-trail.manage-holds',
        'audit-trail.manage-alerts',
        'audit-trail.verify-integrity',
        'audit-trail.manage-event-types',
        'audit-trail.manage-retention',
        'audit-trail.manage-ingestion',
        'audit-trail.audit-access',
        'audit-trail.admin',
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

            $sgPerms = [
                'audit-trail.view-own-records',
                'audit-trail.view-record-history',
                'audit-trail.view-department',
                'audit-trail.view-module',
                'audit-trail.view-security',
                'audit-trail.view-privileged',
                'audit-trail.search',
                'audit-trail.export',
                'audit-trail.verify-integrity',
                'audit-trail.manage-holds',
                'audit-trail.audit-access',
            ];
            foreach (['Secretary General'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo(
                        Permission::whereIn('name', $sgPerms)->where('guard_name', $guard)->get()
                    );
                }
            }

            $auditorPerms = [
                'audit-trail.view-record-history',
                'audit-trail.view-module',
                'audit-trail.search',
                'audit-trail.export',
                'audit-trail.verify-integrity',
            ];
            foreach (['Internal Auditor', 'External Auditor'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo(
                        Permission::whereIn('name', $auditorPerms)->where('guard_name', $guard)->get()
                    );
                }
            }

            $staffPerms = [
                'audit-trail.view-own-records',
                'audit-trail.view-record-history',
            ];
            foreach (['staff', 'Staff'] as $roleName) {
                $role = Role::where('name', $roleName)->where('guard_name', $guard)->first();
                if ($role) {
                    $role->givePermissionTo(
                        Permission::whereIn('name', $staffPerms)->where('guard_name', $guard)->get()
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
