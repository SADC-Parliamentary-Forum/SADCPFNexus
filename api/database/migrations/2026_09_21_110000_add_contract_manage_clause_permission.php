<?php

use App\Modules\AccessControl\Services\CanonicalRoleManager;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

/**
 * Dedicated clause-library admin permission (PRD §93). Idempotent: firstOrCreate
 * then re-synchronise canonical roles so Procurement Officer receives the grant.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['sanctum', 'web'] as $guard) {
            Permission::firstOrCreate(['name' => 'contract.manage_clause', 'guard_name' => $guard]);
        }

        app(CanonicalRoleManager::class)->synchronize();
    }

    public function down(): void
    {
        Permission::where('name', 'contract.manage_clause')->delete();
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
