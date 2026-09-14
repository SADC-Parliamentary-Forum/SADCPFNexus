<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $permissions = [
            'procurement.supplier.bank.view',
            'procurement.supplier.verify',
            'procurement.supplier.invite',
        ];

        foreach ($permissions as $name) {
            $exists = DB::table('permissions')->where('name', $name)->where('guard_name', 'sanctum')->exists();
            if (! $exists) {
                DB::table('permissions')->insert([
                    'name' => $name,
                    'guard_name' => 'sanctum',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $grants = [
            'System Admin' => $permissions,
            'Secretary General' => $permissions,
            'Procurement Officer' => $permissions,
            'Finance Controller' => ['procurement.supplier.bank.view'],
            'Finance Officer' => ['procurement.supplier.bank.view'],
        ];

        foreach ($grants as $roleName => $permNames) {
            $role = DB::table('roles')->where('name', $roleName)->where('guard_name', 'sanctum')->first();
            if (! $role) {
                continue;
            }
            foreach ($permNames as $permName) {
                $perm = DB::table('permissions')->where('name', $permName)->where('guard_name', 'sanctum')->first();
                if (! $perm) {
                    continue;
                }
                $exists = DB::table('role_has_permissions')
                    ->where('role_id', $role->id)
                    ->where('permission_id', $perm->id)
                    ->exists();
                if (! $exists) {
                    DB::table('role_has_permissions')->insert([
                        'permission_id' => $perm->id,
                        'role_id' => $role->id,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // Permissions remain; role catalogue is the source of truth after seed.
    }
};
