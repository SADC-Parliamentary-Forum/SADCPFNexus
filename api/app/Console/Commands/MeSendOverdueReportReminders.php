<?php

namespace App\Console\Commands;

use App\Models\MeActivityReport;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class MeSendOverdueReportReminders extends Command
{
    protected $signature = 'mande:send-overdue-reminders';

    protected $description = 'Notify responsible officers of overdue M&E activity reports';

    public function handle(NotificationService $notifications): int
    {
        $overdue = MeActivityReport::query()
            ->whereIn('review_status', [
                MeActivityReport::STATUS_NOT_SUBMITTED,
                MeActivityReport::STATUS_RETURNED,
            ])
            ->whereNotNull('report_due_at')
            ->where('report_due_at', '<', now())
            ->whereNull('archived_at')
            ->with(['responsibleOfficer', 'creator'])
            ->get();

        $sent = 0;
        foreach ($overdue as $report) {
            $recipients = array_filter([$report->responsibleOfficer, $report->creator]);
            $seen = [];
            foreach ($recipients as $recipient) {
                if (! $recipient instanceof User || isset($seen[$recipient->id])) {
                    continue;
                }
                $seen[$recipient->id] = true;
                try {
                    $notifications->dispatch($recipient, 'mande.activity_report.overdue', [
                        'name'      => $recipient->name,
                        'reference' => $report->reference_number,
                        'title'     => $report->activity_title,
                    ], [
                        'module'    => 'mande',
                        'record_id' => $report->id,
                        'url'       => '/mande/activity-reports/' . $report->id,
                    ], false);
                    $sent++;
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        }

        $this->info("Sent {$sent} overdue M&E reminder(s).");

        return self::SUCCESS;
    }
}
