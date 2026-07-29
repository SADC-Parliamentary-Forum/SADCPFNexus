<?php

namespace App\Console\Commands;

use App\Modules\Risk\Services\RiskControlTestingService;
use Illuminate\Console\Command;

class RiskMarkControlTestsOverdue extends Command
{
    protected $signature = 'risk:mark-control-tests-overdue {--tenant= : Limit to a single tenant id}';

    protected $description = 'Mark pending/in-progress control tests past due_at as overdue';

    public function handle(RiskControlTestingService $service): int
    {
        $tenantId = $this->option('tenant');
        $count = $service->markOverdueItems($tenantId ? (int) $tenantId : null);
        $this->info("Marked {$count} control-test item(s) overdue.");

        return self::SUCCESS;
    }
}
