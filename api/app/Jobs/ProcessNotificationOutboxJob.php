<?php

namespace App\Jobs;

use App\Modules\Notifications\Services\NotificationDispatchService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessNotificationOutboxJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $outboxId) {}

    public function handle(NotificationDispatchService $dispatch): void
    {
        $dispatch->consumeOutboxId($this->outboxId);
    }
}
