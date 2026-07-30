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

    public function scopes(): array
    {
        return config('access_control.scopes', []);
    }
}
