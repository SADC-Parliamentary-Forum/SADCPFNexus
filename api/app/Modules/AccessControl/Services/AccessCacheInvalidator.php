<?php

namespace App\Modules\AccessControl\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

class AccessCacheInvalidator
{
    public function key(User $actor): string
    {
        return sprintf('access_control:effective:%s:%s', $actor->tenant_id ?? '0', $actor->id);
    }

    public function rememberEffective(User $actor, callable $callback): array
    {
        $ttl = (int) config('access_control.cache_ttl_seconds', 60);

        return Cache::remember($this->key($actor), $ttl, $callback);
    }

    public function invalidate(User $actor): void
    {
        Cache::forget($this->key($actor));

        // Spatie permission cache
        try {
            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        } catch (\Throwable) {
        }
    }

    public function invalidateUserId(int $userId, ?int $tenantId = null): void
    {
        Cache::forget(sprintf('access_control:effective:%s:%s', $tenantId ?? '0', $userId));
        try {
            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        } catch (\Throwable) {
        }
    }
}
