<?php

namespace App\Modules\AccessControl\Services;

use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\DB;

/**
 * The single synchronisation point for the platform role catalogue.
 *
 * Legacy role names are retained as compatibility aliases for old code and
 * historical records, but their permissions are replaced from the canonical
 * templates on every seed. This deliberately uses syncPermissions: removed
 * permissions must be revoked, not left behind by an additive merge.
 */
class CanonicalRoleManager
{
    public const SYSTEM_ROLES = ['System Admin', 'System Administrator', 'super-admin', 'admin', 'Admin'];

    public function synchronize(): void
    {
        foreach (['sanctum', 'web'] as $guard) {
            $this->synchronizeGuard($guard);
        }

        $this->synchronizeCatalogue();

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function canonicalRoleNames(): array
    {
        return array_keys(config('access_control.role_templates', []));
    }

    public function isAssignableRole(string $name): bool
    {
        return in_array($name, array_merge($this->canonicalRoleNames(), self::SYSTEM_ROLES), true);
    }

    public function legacyRoleMap(): array
    {
        return [
            'staff' => 'General Employee',
            'HOD' => 'Supervisor / Line Manager',
            'Director' => 'Head of Department / Director',
            'HR Manager' => 'HR and Administration Officer',
            'HR Administrator' => 'HR and Administration Officer',
            'Administration Officer' => 'HR and Administration Officer',
            'Finance Controller' => 'Finance Officer',
            'Procurement Officer' => 'Procurement Officer',
            'Committee Member' => 'Procurement Evaluation Committee Member',
            'Internal Auditor' => 'Internal Auditor',
            'Supplier' => 'External Supplier',
            'Supplier Finance User' => 'External Supplier',
        ];
    }

    public function canonicalize(string $name): string
    {
        return $this->legacyRoleMap()[$name] ?? $name;
    }

    private function synchronizeGuard(string $guard): void
    {
        $templates = config('access_control.role_templates', []);
        $permissions = Permission::where('guard_name', $guard)->get()->keyBy('name');

        $rolePermissions = [];
        foreach ($templates as $name => $meta) {
            $keys = $this->registry()->rolePermissions($name);
            $targets = array_values(array_unique(array_merge([$name], $meta['legacy_roles'] ?? [])));
            foreach ($targets as $targetName) {
                if (in_array($targetName, self::SYSTEM_ROLES, true)) {
                    continue;
                }
                $rolePermissions[$targetName] = array_values(array_unique(array_merge(
                    $rolePermissions[$targetName] ?? [],
                    $keys,
                )));
            }
        }

        foreach ($rolePermissions as $targetName => $keys) {
            $models = collect($keys)
                ->map(fn (string $key) => $permissions->get($key))
                ->filter()
                ->values()
                ->all();
            Role::firstOrCreate(['name' => $targetName, 'guard_name' => $guard])
                ->syncPermissions($models);
        }

        foreach (self::SYSTEM_ROLES as $name) {
            Role::firstOrCreate(['name' => $name, 'guard_name' => $guard])
                ->syncPermissions($permissions->values()->all());
        }
    }

    private function synchronizeCatalogue(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('access_role_catalogues')) {
            return;
        }

        $templates = config('access_control.role_templates', []);
        foreach ($templates as $name => $meta) {
            $key = Str::slug($name, '_');
            $catalogue = DB::table('access_role_catalogues')->whereNull('tenant_id')->where('key', $key)->first();
            $values = [
                'name' => $name,
                'purpose' => $meta['purpose'] ?? null,
                'risk_level' => $meta['risk_level'] ?? 'medium',
                'status' => 'active',
                'default_scopes' => json_encode(['organisation']),
                'feature_only' => (bool) ($meta['feature_only'] ?? false),
                'read_only' => (bool) ($meta['read_only'] ?? false),
                'no_business_approve' => (bool) ($meta['no_business_approve'] ?? false),
                'updated_at' => now(),
            ];
            if (! $catalogue) {
                $catalogueId = DB::table('access_role_catalogues')->insertGetId(array_merge($values, [
                    'tenant_id' => null,
                    'key' => $key,
                    'created_at' => now(),
                ]));
            } else {
                $catalogueId = $catalogue->id;
                DB::table('access_role_catalogues')->where('id', $catalogueId)->update($values);
            }

            $permissions = $this->registry()->rolePermissions($name);
            $activeVersion = DB::table('access_role_versions')
                ->where('role_catalogue_id', $catalogueId)
                ->where('status', 'active')
                ->orderByDesc('version')
                ->first();

            if (! $activeVersion) {
                DB::table('access_role_versions')->insert([
                    'role_catalogue_id' => $catalogueId,
                    'version' => 1,
                    'status' => 'active',
                    'permissions' => json_encode($permissions),
                    'changelog' => 'Canonical role catalogue synchronized',
                    'published_at' => now(),
                    'approved_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                continue;
            }

            $storedPermissions = is_string($activeVersion->permissions)
                ? json_decode($activeVersion->permissions, true)
                : $activeVersion->permissions;

            if ($this->permissionSetHash($storedPermissions) !== $this->permissionSetHash($permissions)) {
                $nextVersion = ((int) DB::table('access_role_versions')
                    ->where('role_catalogue_id', $catalogueId)
                    ->max('version')) + 1;

                DB::transaction(function () use ($catalogueId, $nextVersion, $permissions): void {
                    DB::table('access_role_versions')
                        ->where('role_catalogue_id', $catalogueId)
                        ->where('status', 'active')
                        ->update(['status' => 'retired', 'updated_at' => now()]);

                    DB::table('access_role_versions')->insert([
                        'role_catalogue_id' => $catalogueId,
                        'version' => $nextVersion,
                        'status' => 'active',
                        'permissions' => json_encode($permissions),
                        'changelog' => 'Canonical role catalogue synchronized from registry changes',
                        'published_at' => now(),
                        'approved_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                });
            }
        }
    }

    private function permissionSetHash(mixed $permissions): string
    {
        $permissions = is_array($permissions) ? $permissions : [];
        $permissions = array_values(array_unique(array_filter($permissions, 'is_string')));
        sort($permissions);

        return hash('sha256', json_encode($permissions));
    }

    private function registry(): PermissionRegistry
    {
        return app(PermissionRegistry::class);
    }
}
