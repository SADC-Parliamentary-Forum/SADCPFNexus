<?php

namespace App\Modules\AccessControl\Services;

use Illuminate\Support\Arr;

class PermissionRegistry
{
    public function all(): array
    {
        return config('access_control.permissions', []);
    }

    public function get(string $key): ?array
    {
        return $this->all()[$key] ?? null;
    }

    public function exists(string $key): bool
    {
        return $this->get($key) !== null || $this->isLegacyKey($key);
    }

    public function isLegacyKey(string $key): bool
    {
        return array_key_exists($key, config('access_control.legacy_aliases', []));
    }

    public function expandLegacy(string $legacyKey): array
    {
        return config('access_control.legacy_aliases.'.$legacyKey, []);
    }

    /**
     * Expand a permission key into itself plus any legacy keys that map to it,
     * and for legacy keys expand to their canonical set.
     *
     * @return list<string>
     */
    public function resolveEquivalents(string $permission): array
    {
        $keys = [$permission];

        if ($this->isLegacyKey($permission)) {
            $keys = array_merge($keys, $this->expandLegacy($permission));
        }

        foreach (config('access_control.legacy_aliases', []) as $legacy => $canonicals) {
            if (in_array($permission, $canonicals, true)) {
                $keys[] = $legacy;
            }
        }

        return array_values(array_unique($keys));
    }

    public function modules(): array
    {
        return array_values(array_unique(Arr::pluck($this->all(), 'module')));
    }

    public function roleTemplates(): array
    {
        return config('access_control.role_templates', []);
    }

    /**
     * Return the complete permission set for a role, including all inherited
     * roles. The recursive expansion is cycle-safe so a bad draft cannot make
     * access administration recurse indefinitely.
     *
     * @return list<string>
     */
    public function rolePermissions(string $roleName): array
    {
        $templates = $this->roleTemplates();

        return $this->expandRolePermissions($roleName, $templates);
    }

    public function scopes(): array
    {
        return config('access_control.scopes', []);
    }

    private function expandRolePermissions(string $roleName, array $templates, array $seen = []): array
    {
        if (in_array($roleName, $seen, true)) {
            return [];
        }

        $template = $templates[$roleName] ?? null;
        if (! is_array($template)) {
            return [];
        }

        $seen[] = $roleName;
        $permissions = $template['permissions'] ?? [];

        foreach ($template['inherits'] ?? [] as $parent) {
            $permissions = array_merge(
                $permissions,
                $this->expandRolePermissions((string) $parent, $templates, $seen),
            );
        }

        return array_values(array_unique(array_filter($permissions, 'is_string')));
    }
}
