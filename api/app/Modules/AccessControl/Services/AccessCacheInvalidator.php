<?php

namespace App\Modules\AccessControl\Services;

use App\Models\User;
use App\Models\UserSession;
use Illuminate\Support\Facades\Cache;

/**
 * Invalidates effective-permission caches and forces privileged session refresh
 * when roles/grants change (Phase 7 residual: session kill on revoke).
 */
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

    public function invalidate(User $actor, bool $forceSessionRefresh = true): void
    {
        Cache::forget($this->key($actor));

        try {
            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        } catch (\Throwable) {
        }

        if ($forceSessionRefresh) {
            $this->forceSessionRefresh($actor);
        }
    }

    public function invalidateUserId(int $userId, ?int $tenantId = null, bool $forceSessionRefresh = true): void
    {
        Cache::forget(sprintf('access_control:effective:%s:%s', $tenantId ?? '0', $userId));
        try {
            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        } catch (\Throwable) {
        }

        if ($forceSessionRefresh) {
            $user = User::query()->find($userId);
            if ($user) {
                $this->forceSessionRefresh($user);
            }
        }
    }

    /**
     * Kill Sanctum tokens + tracked UserSession rows so the next request
     * requires re-authentication with the new privilege set.
     */
    public function forceSessionRefresh(User $actor): void
    {
        try {
            $actor->tokens()->delete();
        } catch (\Throwable) {
        }

        try {
            UserSession::where('user_id', $actor->id)->delete();
        } catch (\Throwable) {
        }
    }
}
