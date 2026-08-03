<?php

namespace App\Console\Commands;

use App\Modules\Reports\Services\ReportManagementService;
use Illuminate\Console\Command;

class DispatchScheduledReports extends Command
{
    protected $signature = 'reports:dispatch-scheduled {--tenant= : Limit dispatch to one tenant ID}';
    protected $description = 'Queue due, approved scheduled management-information reports.';

    public function handle(ReportManagementService $reports): int
    {
        $tenant = $this->option('tenant');
        $count = $reports->dispatchDueSchedules($tenant ? (int) $tenant : null);
        $this->info("Queued {$count} scheduled report run(s).");

        return self::SUCCESS;
    }
}
