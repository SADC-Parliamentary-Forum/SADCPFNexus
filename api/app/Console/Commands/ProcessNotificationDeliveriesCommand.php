<?php

namespace App\Console\Commands;

use App\Modules\Notifications\Services\AckCampaignService;
use App\Modules\Notifications\Services\BroadcastService;
use App\Modules\Notifications\Services\ChannelDeliveryService;
use App\Modules\Notifications\Services\CoalescingService;
use App\Modules\Notifications\Services\NotificationDispatchService;
use Illuminate\Console\Command;

class ProcessNotificationDeliveriesCommand extends Command
{
    protected $signature = 'notifications:process-deliveries {--digest=} {--retries} {--scheduled} {--coalesce} {--ack-reminders} {--maintenance}';

    protected $description = 'Retry deliveries, digests, scheduled, coalesce flush, ack reminders, maintenance revalidation';

    public function handle(
        NotificationDispatchService $dispatch,
        ChannelDeliveryService $channels,
        CoalescingService $coalesce,
        AckCampaignService $acks,
        BroadcastService $broadcasts,
    ): int {
        if ($this->option('retries')) {
            $n = $dispatch->processRetries();
            $this->info("Retried {$n} delivery(ies).");
        }

        if ($this->option('scheduled')) {
            $n = $channels->processScheduled();
            $this->info("Processed {$n} scheduled delivery(ies).");
        }

        if ($this->option('coalesce')) {
            $n = $coalesce->flushDue();
            $this->info("Flushed {$n} coalesce bucket(s).");
        }

        if ($this->option('ack-reminders')) {
            $n = $acks->processDueReminders();
            $this->info("Sent {$n} acknowledgement reminder(s).");
        }

        if ($this->option('maintenance')) {
            $n = $broadcasts->revalidateMaintenance();
            $this->info("Revalidated {$n} maintenance alert(s).");
        }

        $digest = $this->option('digest');
        if ($digest) {
            $n = $channels->sendPendingDigests($digest);
            $this->info("Sent {$n} {$digest} digest(s).");
        }

        return self::SUCCESS;
    }
}
