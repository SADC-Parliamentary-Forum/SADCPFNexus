<?php

namespace App\Modules\WeeklySummary\Services;

use App\Models\User;
use App\Models\WeeklySummaryPreference;
use Illuminate\Support\Collection;

class WeeklySummaryAudienceService
{
    /**
     * Resolve all users in the given tenant who should receive the weekly summary.
     * Excludes users who have explicitly opted out via WeeklySummaryPreference.
     */
    public function resolve(int $tenantId): Collection
    {
        // Load opted-out user IDs
        $optedOut = WeeklySummaryPreference::where('enabled', false)
            ->pluck('user_id')
            ->flip();

        return User::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereNotNull('email')
            ->get()
            ->reject(fn (User $u) => isset($optedOut[$u->id]));
    }
}
