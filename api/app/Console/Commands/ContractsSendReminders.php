<?php

namespace App\Console\Commands;

use App\Modules\Contracts\Services\ContractReminderService;
use Illuminate\Console\Command;

class ContractsSendReminders extends Command
{
    protected $signature = 'contracts:send-reminders {--tenant=}';

    protected $description = 'Send contract signature, expiry and deliverable reminders and escalate overdue items (PRD §64-66)';

    public function handle(ContractReminderService $service): int
    {
        $tenantId = $this->option('tenant') ? (int) $this->option('tenant') : null;
        $sent = $service->run($tenantId);
        $this->info("Dispatched {$sent} contract reminder(s).");

        return self::SUCCESS;
    }
}
