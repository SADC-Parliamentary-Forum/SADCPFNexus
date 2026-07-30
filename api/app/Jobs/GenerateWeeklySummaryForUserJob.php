<?php

namespace App\Jobs;

use App\Mail\WeeklySummaryMail;
use App\Models\User;
use App\Models\WeeklySummaryDeliveryEvent;
use App\Models\WeeklySummaryRun;
use App\Modules\WeeklySummary\Services\WeeklySummaryGeneratorService;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Generates and sends a weekly summary report for a single user via the Notifications outbox.
 */
class GenerateWeeklySummaryForUserJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(
        public readonly WeeklySummaryRun $run,
        public readonly User             $user
    ) {}

    public function handle(WeeklySummaryGeneratorService $generator, NotificationService $notifications): void
    {
        try {
            $report = $generator->generate($this->run, $this->user);

            $start = $report->period_start->format('d M');
            $end = $report->period_end->format('d M Y');
            $period = "{$start} to {$end}";

            $notifications->dispatchTrackedMailable(
                (int) $this->user->tenant_id,
                'weekly_summary.generated',
                (string) $this->user->email,
                (string) $this->user->name,
                new WeeklySummaryMail($report),
                [
                    'module' => 'weekly_summary',
                    'record_id' => $report->id,
                    'source_type' => $report::class,
                    'subject' => "SADCPFNexus Weekly Summary – {$period}",
                    'body' => "Your weekly summary for {$period} is ready.",
                    'url' => '/weekly-summaries',
                    'idempotency_key' => 'weekly_summary.generated:'.$report->id,
                ],
                $this->user,
                null,
                "SADCPFNexus Weekly Summary – {$period}",
            );

            $report->update(['status' => 'queued']);

            WeeklySummaryDeliveryEvent::create([
                'report_id'  => $report->id,
                'event_type' => 'queued',
            ]);

            $this->run->increment('total_generated');
            $this->run->increment('total_sent');

        } catch (\Throwable $e) {
            Log::error("WeeklySummary generation failed for user {$this->user->id}", [
                'error' => $e->getMessage(),
            ]);

            $this->run->increment('total_failed');

            // If a report was partially created, mark it failed
            $report = $this->run->reports()->where('user_id', $this->user->id)->first();
            if ($report) {
                $report->update([
                    'status'         => 'failed',
                    'failure_reason' => $e->getMessage(),
                ]);
                WeeklySummaryDeliveryEvent::create([
                    'report_id'    => $report->id,
                    'event_type'   => 'failed',
                    'event_payload'=> ['error' => $e->getMessage()],
                ]);
            }
        }

        // Mark run completed if all users have been processed
        $processed = $this->run->total_generated + $this->run->total_failed;
        if ($processed >= $this->run->total_users) {
            $status = $this->run->total_failed > 0
                ? ($this->run->total_generated > 0 ? 'partial' : 'failed')
                : 'completed';
            $this->run->update(['status' => $status, 'completed_at' => now()]);
        }
    }
}
