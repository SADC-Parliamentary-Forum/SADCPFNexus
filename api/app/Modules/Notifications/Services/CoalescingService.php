<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationCoalesceBucket;
use App\Models\Notifications\NotificationCoalesceItem;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Str;

/**
 * High-frequency updates coalesce; critical/action notices flush immediately.
 */
class CoalescingService
{
    public function shouldCoalesce(array $policy, array $meta): bool
    {
        if (($policy['action_required'] ?? false) || ($policy['mandatory'] ?? false)) {
            return false;
        }
        if (($meta['force_immediate'] ?? false) === true) {
            return false;
        }
        // Opt-in only — never silently delay normal transactional/inbox notices.
        if (($meta['coalesce'] ?? false) !== true && empty($meta['coalesce_key'])) {
            return false;
        }

        $class = $policy['delivery_class'] ?? 'operational';

        return in_array($class, ['digest_eligible', 'operational'], true);
    }

    public function enqueue(User $user, string $eventKey, string $summary, array $payload = [], ?string $coalesceKey = null): NotificationCoalesceBucket
    {
        $key = $coalesceKey ?: ($payload['coalesce_key'] ?? ($eventKey.'.'.$user->id));
        $window = (int) config('notifications.coalesce_window_seconds', 120);

        $bucket = NotificationCoalesceBucket::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('user_id', $user->id)
            ->where('coalesce_key', $key)
            ->where('status', 'open')
            ->where('window_ends_at', '>', now())
            ->first();

        if (! $bucket) {
            $bucket = NotificationCoalesceBucket::create([
                'tenant_id' => $user->tenant_id,
                'user_id' => $user->id,
                'coalesce_key' => $key,
                'status' => 'open',
                'critical' => false,
                'window_starts_at' => now(),
                'window_ends_at' => now()->addSeconds($window),
            ]);
        }

        $max = (int) config('notifications.coalesce_max_items', 20);
        $count = NotificationCoalesceItem::query()->where('bucket_id', $bucket->id)->count();
        if ($count < $max) {
            NotificationCoalesceItem::create([
                'bucket_id' => $bucket->id,
                'event_key' => $eventKey,
                'summary' => Str::limit($summary, 500),
                'payload' => $payload,
            ]);
        }

        return $bucket->fresh();
    }

    public function flushDue(int $limit = 50): int
    {
        $buckets = NotificationCoalesceBucket::query()
            ->where('status', 'open')
            ->where('window_ends_at', '<=', now())
            ->limit($limit)
            ->get();

        $flushed = 0;
        foreach ($buckets as $bucket) {
            $this->flushBucket($bucket);
            $flushed++;
        }

        return $flushed;
    }

    public function flushBucket(NotificationCoalesceBucket $bucket): void
    {
        if ($bucket->status !== 'open') {
            return;
        }

        $user = User::find($bucket->user_id);
        if (! $user) {
            $bucket->update(['status' => 'cancelled']);

            return;
        }

        $items = NotificationCoalesceItem::query()->where('bucket_id', $bucket->id)->get();
        $lines = $items->map(fn ($i) => '- '.$i->summary)->implode("\n");
        $subject = 'Nexus update summary ('.$items->count().' items)';
        $body = "Dear {$user->name},\n\nCombined updates:\n\n{$lines}\n\nSign in to Nexus for details.";

        app(NotificationService::class)->dispatch(
            $user,
            'notifications.coalesced_digest',
            ['name' => $user->name, 'summary' => $subject, 'details' => $body],
            [
                'module' => 'notifications',
                'url' => '/notifications',
                'coalesce' => false,
                'force_immediate' => true,
                'record_id' => $bucket->id,
                'idempotency_key' => 'coalesce:'.$bucket->id,
            ],
            true,
            false,
            'coalesce:'.$bucket->id,
        );

        $notificationId = \App\Models\Notification::query()
            ->where('user_id', $user->id)
            ->where('trigger', 'notifications.coalesced_digest')
            ->latest('id')
            ->value('id');

        $bucket->update([
            'status' => 'flushed',
            'flushed_at' => now(),
            'flushed_notification_id' => $notificationId,
        ]);
    }
}
