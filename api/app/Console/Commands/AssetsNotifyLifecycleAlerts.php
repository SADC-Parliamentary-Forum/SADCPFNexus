<?php

namespace App\Console\Commands;

use App\Models\Asset;
use App\Models\User;
use App\Modules\Assets\Services\AssetCheckoutService;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class AssetsNotifyLifecycleAlerts extends Command
{
    protected $signature = 'assets:notify-lifecycle-alerts';

    protected $description = 'Notify overdue asset checkouts and upcoming warranty expiries';

    public function handle(AssetCheckoutService $checkouts, NotificationService $notifications): int
    {
        $overdue = $checkouts->notifyOverdue();
        $handovers = app(\App\Modules\Assets\Services\AssetHandoverService::class)->sendReminders();

        $warranty = 0;
        $assets = Asset::query()
            ->whereNotNull('warranty_expiry')
            ->whereNotIn('status', array_merge(Asset::DISPOSED_STATUSES, ['retired']))
            ->whereBetween('warranty_expiry', [now()->toDateString(), now()->addDays(90)->toDateString()])
            ->get();

        foreach ($assets as $asset) {
            $days = (int) round(now()->startOfDay()->diffInDays($asset->warranty_expiry, false));
            if (! in_array($days, [90, 30, 7], true)) {
                continue;
            }
            $admins = User::query()
                ->where('tenant_id', $asset->tenant_id)
                ->where('is_active', true)
                ->permission(['assets.manage', 'assets.admin'])
                ->get();
            foreach ($admins as $admin) {
                $notifications->dispatch($admin, 'assets.warranty_expiring', [
                    'name' => $admin->name,
                    'asset' => $asset->name,
                    'tag' => $asset->tag_number ?: $asset->asset_code,
                    'date' => optional($asset->warranty_expiry)->toDateString(),
                ], ['idempotency_key' => 'warranty-'.$asset->id.'-'.$days]);
                $warranty++;
            }
        }

        $this->info("Overdue checkouts notified: {$overdue}. Warranty notices: {$warranty}. Handover reminders: {$handovers}.");

        return self::SUCCESS;
    }
}
