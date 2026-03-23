<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

return new class extends Migration
{
    private array $newPermissions = [
        'calendar.view', 'calendar.create', 'calendar.admin',
        'support.view',  'support.create',  'support.admin',
    ];

    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach ($this->newPermissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }
    }

    public function down(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach ($this->newPermissions as $perm) {
            Permission::where('name', $perm)->delete();
        }
    }
};
