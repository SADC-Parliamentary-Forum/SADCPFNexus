<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDeadLetter;
use App\Models\Notifications\NotificationRecord;
use App\Models\Notifications\NotificationRecipient;
use Illuminate\Support\Facades\DB;

class DeliveryAnalyticsService
{
    public function summary(int $tenantId, ?string $from = null, ?string $to = null): array
    {
        $fromAt = $from ? \Carbon\Carbon::parse($from) : now()->subDays(7);
        $toAt = $to ? \Carbon\Carbon::parse($to) : now();

        $base = NotificationChannelDelivery::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$fromAt, $toAt]);

        $byChannel = (clone $base)
            ->select('channel', DB::raw('count(*) as total'), DB::raw("sum(case when status in ('sent','delivered') then 1 else 0 end) as success"), DB::raw("sum(case when status = 'failed' then 1 else 0 end) as failed"), DB::raw('avg(latency_ms) as avg_latency_ms'))
            ->groupBy('channel')
            ->get();

        $bounces = (clone $base)
            ->whereNotNull('bounce_class')
            ->select('bounce_class', DB::raw('count(*) as total'))
            ->groupBy('bounce_class')
            ->pluck('total', 'bounce_class');

        $dead = NotificationDeadLetter::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->select('failure_code', DB::raw('count(*) as total'))
            ->groupBy('failure_code')
            ->pluck('total', 'failure_code');

        $recipientIds = (clone $base)->pluck('recipient_id')->unique()->filter()->values();
        $recordIds = NotificationRecipient::query()->whereIn('id', $recipientIds)->pluck('notification_record_id');
        $types = NotificationRecord::query()->whereIn('id', $recordIds)->pluck('notification_type');
        $byModule = $types->map(fn ($t) => explode('.', (string) $t)[0] ?? 'general')
            ->countBy()
            ->map(fn ($total, $module) => ['module' => $module, 'total' => $total])
            ->values();

        return [
            'window' => ['from' => $fromAt->toIso8601String(), 'to' => $toAt->toIso8601String()],
            'by_channel' => $byChannel,
            'bounces' => $bounces,
            'dead_letters' => $dead,
            'by_module' => $byModule,
            'totals' => [
                'deliveries' => (clone $base)->count(),
                'success' => (clone $base)->whereIn('status', ['sent', 'delivered'])->count(),
                'failed' => (clone $base)->where('status', 'failed')->count(),
                'avg_latency_ms' => (clone $base)->avg('latency_ms'),
            ],
        ];
    }
}
