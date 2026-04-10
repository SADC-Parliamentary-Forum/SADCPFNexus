<?php

namespace App\Jobs;

use App\Models\Tenant;
use App\Models\WeeklySummaryRun;
use App\Modules\WeeklySummary\Services\WeeklySummaryAudienceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

/**
 * Kicks off the weekly summary batch.
 * Creates one WeeklySummaryRun per tenant and dispatches per-user jobs.
 * Scheduled every Friday at 16:00 via routes/console.php.
 */
class RunWeeklySummaryBatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(WeeklySummaryAudienceService $audience): void
    {
        $now         = Carbon::now();
        $periodStart = $now->copy()->startOfWeek();   // Monday 00:00
        $periodEnd   = $now->copy()->endOfWeek();     // Sunday 23:59

        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            $users = $audience->resolve($tenant->id);

            if ($users->isEmpty()) {
                continue;
            }

            $run = WeeklySummaryRun::create([
                'tenant_id'     => $tenant->id,
                'period_start'  => $periodStart->toDateString(),
                'period_end'    => $periodEnd->toDateString(),
                'scheduled_for' => $now,
                'started_at'    => $now,
                'status'        => 'running',
                'total_users'   => $users->count(),
            ]);

            foreach ($users as $user) {
                GenerateWeeklySummaryForUserJob::dispatch($run, $user);
            }

            // Mark run completed after all jobs dispatched
            // (actual completion tracking happens in GenerateWeeklySummaryForUserJob)
            $run->update(['status' => 'running']);
        }
    }
}
