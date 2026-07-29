<?php

namespace App\Console\Commands;

use App\Modules\Decisions\Services\DecisionAssignmentPromoteService;
use Illuminate\Console\Command;

class DecisionsPromoteWeeklyAssignments extends Command
{
    protected $signature = 'decisions:promote-weekly-assignments {--tenant= : Limit to a single tenant id}';

    protected $description = 'Idempotently promote open adopted decisions/resolutions into the Assignments feed';

    public function handle(DecisionAssignmentPromoteService $service): int
    {
        $tenantId = $this->option('tenant');
        if ($tenantId) {
            $result = $service->promoteTenant((int) $tenantId);
            $this->info("Tenant {$tenantId}: promoted={$result['promoted']} skipped={$result['skipped']}");
        } else {
            $result = $service->promoteAll();
            $this->info("Tenants={$result['tenants']} promoted={$result['promoted']} skipped={$result['skipped']}");
        }

        return self::SUCCESS;
    }
}
