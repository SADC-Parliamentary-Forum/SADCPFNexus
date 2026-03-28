<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Generalises the "SRHR Researcher" concept into a broader "Field Researcher" role.
 *
 * Changes:
 *  1. Adds `research_area` and `research_focus` columns to staff_deployments
 *     (researchers are not always SRHR — they may cover Governance, Gender, Elections, etc.)
 *  2. Renames the "SRHR Researcher" role to "Field Researcher"
 *  3. Expands Field Researcher permissions to include PIF creation, imprest,
 *     correspondence, and procurement (they organise meetings, seek quotes,
 *     write memos/concept notes, pay service providers)
 */
return new class extends Migration
{
    private array $additionalPermissions = [
        'pif.create',
        'imprest.view',
        'imprest.create',
        'correspondence.view',
        'correspondence.create',
        'procurement.view',
        'procurement.create',
    ];

    public function up(): void
    {
        // 1. Add research columns to staff_deployments
        Schema::table('staff_deployments', function (Blueprint $table) {
            $table->string('research_area', 64)->nullable()->after('deployment_type');
            $table->text('research_focus')->nullable()->after('research_area');
        });

        // 2. Rename role + expand permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            // Ensure new permissions exist
            foreach ($this->additionalPermissions as $perm) {
                Permission::firstOrCreate(['name' => $perm, 'guard_name' => $guard]);
            }

            // Rename role
            $role = Role::where('name', 'SRHR Researcher')->where('guard_name', $guard)->first();
            if ($role) {
                $role->name = 'Field Researcher';
                $role->save();
            } else {
                // Role may not exist if migration runs standalone — create it
                $role = Role::firstOrCreate(['name' => 'Field Researcher', 'guard_name' => $guard]);
            }

            // Grant expanded permissions
            $role->givePermissionTo(
                Permission::whereIn('name', $this->additionalPermissions)->where('guard_name', $guard)->get()
            );
        }
    }

    public function down(): void
    {
        Schema::table('staff_deployments', function (Blueprint $table) {
            $table->dropColumn(['research_area', 'research_focus']);
        });

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['sanctum', 'web'] as $guard) {
            $role = Role::where('name', 'Field Researcher')->where('guard_name', $guard)->first();
            if ($role) {
                $role->name = 'SRHR Researcher';
                $role->save();
            }
        }
    }
};
