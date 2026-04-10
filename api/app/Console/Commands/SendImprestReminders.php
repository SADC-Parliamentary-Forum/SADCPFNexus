<?php

namespace App\Console\Commands;

use App\Models\ImprestRequest;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Sends imprest retirement reminder emails to staff whose imprests
 * are due for retirement within the next 7 days.
 *
 * Scheduled daily at 08:00 via routes/console.php.
 */
class SendImprestReminders extends Command
{
    protected $signature   = 'app:send-imprest-reminders';
    protected $description = 'Email retirement reminders for imprests due within 7 days';

    public function handle(NotificationService $notif): int
    {
        $today    = Carbon::today();
        $deadline = $today->copy()->addDays(7);
        $sent     = 0;

        $imprests = ImprestRequest::with('requester')
            ->where('status', 'approved')
            ->whereNotNull('expected_liquidation_date')
            ->whereDate('expected_liquidation_date', '>=', $today)
            ->whereDate('expected_liquidation_date', '<=', $deadline)
            ->get();

        foreach ($imprests as $imprest) {
            $requester = $imprest->requester;
            if (! $requester) {
                continue;
            }

            $notif->dispatch($requester, 'imprest.retirement_due', [
                'name'     => $requester->name,
                'amount'   => number_format($imprest->amount_requested, 2) . ' ' . ($imprest->currency ?? 'NAD'),
                'due_date' => Carbon::parse($imprest->expected_liquidation_date)->toFormattedDateString(),
            ], [
                'module'    => 'imprest',
                'record_id' => $imprest->id,
                'url'       => "/imprest/{$imprest->id}",
            ]);

            $sent++;
        }

        $this->info("Imprest reminders sent: {$sent}.");

        return self::SUCCESS;
    }
}
