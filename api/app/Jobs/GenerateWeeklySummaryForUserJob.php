<?php

namespace App\Jobs;

use App\Mail\WeeklySummaryMail;
use App\Models\User;
use App\Models\WeeklySummaryDeliveryEvent;
use App\Models\WeeklySummaryRun;
use App\Modules\WeeklySummary\Services\WeeklySummaryGeneratorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Generates and sends a weekly summary report for a single user.
 */
class GenerateWeeklySummaryForUserJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(
        public readonly WeeklySummaryRun $run,
        public readonly User             $user
    ) {}

    public function handle(WeeklySummaryGeneratorService $generator): void
    {
        try {
            $report = $generator->generate($this->run, $this->user);

            // Queue the email
            Mail::to($this->user->email)->queue(new WeeklySummaryMail($report));

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
