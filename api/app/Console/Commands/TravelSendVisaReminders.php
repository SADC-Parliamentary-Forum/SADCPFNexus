<?php

namespace App\Console\Commands;

use App\Modules\Travel\Services\TravelVisaReminderService;
use Illuminate\Console\Command;

class TravelSendVisaReminders extends Command
{
    protected $signature = 'travel:send-visa-reminders {--tenant=}';

    protected $description = 'Send visa appointment/expiry reminders for travel requests';

    public function handle(TravelVisaReminderService $service): int
    {
        $tenantId = $this->option('tenant') ? (int) $this->option('tenant') : null;
        $n = $service->sendDueReminders($tenantId);
        $this->info("Sent {$n} travel visa reminder(s).");

        return self::SUCCESS;
    }
}
