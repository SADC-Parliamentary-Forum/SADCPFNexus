<?php

namespace App\Console\Commands;

use App\Modules\Notifications\Services\ChannelDeliveryService;
use App\Modules\Notifications\Services\NotificationDispatchService;
use Illuminate\Console\Command;

class ProcessNotificationDeliveriesCommand extends Command
{
    protected $signature = 'notifications:process-deliveries {--digest=} {--retries}';

    protected $description = 'Retry failed deliveries and/or send digests';

    public function handle(NotificationDispatchService $dispatch, ChannelDeliveryService $channels): int
    {
        if ($this->option('retries')) {
            $n = $dispatch->processRetries();
            $this->info("Retried {$n} delivery(ies).");
        }

        $digest = $this->option('digest');
        if ($digest) {
            $n = $channels->sendPendingDigests($digest);
            $this->info("Sent {$n} {$digest} digest(s).");
        }

        return self::SUCCESS;
    }
}
