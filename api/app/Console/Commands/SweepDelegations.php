<?php

namespace App\Console\Commands;

use App\Models\DelegatedAuthority;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * WS1 — fires "delegation activated/expired" notifications idempotently.
 *
 * Runs daily. Uses the *_notified_at columns so each delegate is notified
 * exactly once per lifecycle event.
 */
class SweepDelegations extends Command
{
    protected $signature = 'delegations:sweep';
    protected $description = 'Send delegation activated/expired notifications (WS1).';

    public function handle(NotificationService $notifications): int
    {
        $today = Carbon::today();

        // Newly active, not yet notified.
        DelegatedAuthority::query()
            ->whereNull('activated_notified_at')
            ->whereDate('start_date', '<=', $today->toDateString())
            ->whereDate('end_date', '>=', $today->toDateString())
            ->with(['delegate', 'principal'])
            ->chunkById(200, function ($rows) use ($notifications) {
                foreach ($rows as $d) {
                    $this->notify($notifications, $d, 'delegation.activated');
                    $d->update(['activated_notified_at' => now()]);
                }
            });

        // Recently expired, not yet notified.
        DelegatedAuthority::query()
            ->whereNull('expired_notified_at')
            ->whereDate('end_date', '<', $today->toDateString())
            ->with(['delegate', 'principal'])
            ->chunkById(200, function ($rows) use ($notifications) {
                foreach ($rows as $d) {
                    $this->notify($notifications, $d, 'delegation.expired');
                    $d->update(['expired_notified_at' => now()]);
                }
            });

        $this->info('Delegation sweep complete.');
        return self::SUCCESS;
    }

    private function notify(NotificationService $notifications, DelegatedAuthority $d, string $trigger): void
    {
        if (!$d->delegate) {
            return;
        }
        try {
            $notifications->dispatch(
                $d->delegate,
                $trigger,
                [
                    'name'       => $d->delegate->name,
                    'principal'  => $d->principal?->name ?? 'a colleague',
                    'module'     => $d->module ?? 'all modules',
                    'start_date' => optional($d->start_date)->toDateString(),
                    'end_date'   => optional($d->end_date)->toDateString(),
                ],
                ['module' => 'saam', 'record_id' => $d->id, 'url' => '/saam/delegations'],
                false
            );
        } catch (\Throwable) {
            // ignore
        }
    }
}
