<?php

namespace App\Console\Commands;

use App\Modules\Leave\Services\LeaveToilCreditService;
use Illuminate\Console\Command;

class LeaveManageToilExpiry extends Command
{
    protected $signature = 'leave:manage-toil-expiry {--tenant= : Restrict processing to one tenant ID}';

    protected $description = 'Expire overdue TOIL credits and send configured expiry alerts.';

    public function handle(LeaveToilCreditService $toilCreditService): int
    {
        $tenantId = $this->option('tenant') !== null ? (int) $this->option('tenant') : null;
        $summary = $toilCreditService->manageExpiryAndAlerts($tenantId);

        $this->info("TOIL expiry managed: {$summary['expired']} expired, {$summary['alerts_sent']} alert(s) sent.");

        return self::SUCCESS;
    }
}
