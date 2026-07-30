<?php

namespace App\Console\Commands;

use App\Modules\Notifications\Services\ChannelDeliveryService;
use App\Modules\Notifications\Services\NotificationDispatchService;
use App\Models\Notifications\NotificationOutbox;
use Illuminate\Console\Command;

class ProcessNotificationOutboxCommand extends Command
{
    protected $signature = 'notifications:process-outbox {--limit=100}';

    protected $description = 'Consume pending notification outbox rows';

    public function handle(NotificationDispatchService $dispatch): int
    {
        $limit = (int) $this->option('limit');
        $rows = NotificationOutbox::query()
            ->whereIn('status', ['pending', 'failed'])
            ->where(function ($q) {
                $q->whereNull('available_at')->orWhere('available_at', '<=', now());
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();

        foreach ($rows as $row) {
            $dispatch->consumeOutboxId($row->id);
        }

        $this->info('Processed '.$rows->count().' outbox row(s).');

        return self::SUCCESS;
    }
}
