<?php

namespace App\Modules\AdminConsole\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Live operational probes (measured, not catalogue rows): scheduler heartbeat,
 * database round-trip, queue backlog and failed jobs, notification delivery
 * backlog, and storage. Platform-wide by nature — returns counts only, never
 * job payloads or notification content, so it is safe for the restricted
 * admin console and for `php artisan ops:health`.
 *
 * Each probe returns ['name', 'status', 'meta'] with status one of
 * operational | degraded | major_outage | unknown (AdminConsoleService scale).
 */
class OperationalHealthService
{
    public const HEARTBEAT_KEY = 'ops:scheduler_heartbeat';

    /** Queues drained by the worker (see docker/php/entrypoint.sh QUEUE_NAMES). */
    private const QUEUES = ['notifications-critical', 'notifications', 'default', 'notifications-digest'];

    /** @return array<string, array{name: string, status: string, meta: array<string, mixed>}> */
    public function probes(): array
    {
        return [
            'scheduler' => $this->guard('Scheduler', fn () => $this->scheduler()),
            'database' => $this->guard('Database', fn () => $this->database()),
            'queue_worker' => $this->guard('Queue worker', fn () => $this->queues()),
            'notification_delivery' => $this->guard('Notification delivery', fn () => $this->notifications()),
            'storage' => $this->guard('Document storage', fn () => $this->storage()),
        ];
    }

    public static function recordHeartbeat(): void
    {
        Cache::forever(self::HEARTBEAT_KEY, now()->toIso8601String());
    }

    private function scheduler(): array
    {
        $beat = Cache::get(self::HEARTBEAT_KEY);
        if (! is_string($beat)) {
            return $this->status('Scheduler', 'unknown', ['message' => 'No heartbeat recorded — is the scheduler running?']);
        }

        $age = (int) abs(now()->diffInSeconds(Carbon::parse($beat)));
        $status = $age <= 180 ? 'operational' : ($age <= 900 ? 'degraded' : 'major_outage');

        return $this->status('Scheduler', $status, ['last_heartbeat' => $beat, 'age_seconds' => $age]);
    }

    private function database(): array
    {
        $start = microtime(true);
        DB::select('select 1');
        $ms = (int) round((microtime(true) - $start) * 1000);

        return $this->status('Database', $ms < 500 ? 'operational' : 'degraded', ['latency_ms' => $ms, 'db_driver' => DB::getDriverName()]);
    }

    private function queues(): array
    {
        $failed24h = Schema::hasTable('failed_jobs')
            ? DB::table('failed_jobs')->where('failed_at', '>=', now()->subDay())->count()
            : null;

        $sizes = [];
        foreach (self::QUEUES as $queue) {
            try {
                $sizes[$queue] = Queue::size($queue);
            } catch (Throwable) {
                $sizes[$queue] = null;
            }
        }
        $backlog = array_sum(array_filter($sizes, 'is_int'));

        $status = 'operational';
        if (($failed24h ?? 0) > 0 || $backlog > 500) {
            $status = 'degraded';
        }
        if ($backlog > 5000) {
            $status = 'major_outage';
        }

        // Most important signals first: the console shows the first two scalar values.
        return $this->status('Queue worker', $status, [
            'failed_jobs_24h' => $failed24h,
            'backlog' => $backlog,
            'connection' => config('queue.default'),
            'queue_sizes' => $sizes,
        ]);
    }

    private function notifications(): array
    {
        if (! Schema::hasTable('notification_outbox')) {
            return $this->status('Notification delivery', 'unknown');
        }

        $stalePending = DB::table('notification_outbox')
            ->where('status', 'pending')
            ->where('created_at', '<', now()->subMinutes(10))
            ->count();
        $deadLetters24h = Schema::hasTable('notification_dead_letters')
            ? DB::table('notification_dead_letters')->where('created_at', '>=', now()->subDay())->count()
            : null;
        $failedDeliveries24h = Schema::hasTable('notification_channel_deliveries')
            ? DB::table('notification_channel_deliveries')->where('status', 'failed')->where('updated_at', '>=', now()->subDay())->count()
            : null;

        $status = ($stalePending > 0 || ($deadLetters24h ?? 0) > 0 || ($failedDeliveries24h ?? 0) > 0) ? 'degraded' : 'operational';
        if ($stalePending > 200) {
            $status = 'major_outage';
        }

        return $this->status('Notification delivery', $status, [
            'outbox_pending_over_10_min' => $stalePending,
            'dead_letters_24h' => $deadLetters24h,
            'failed_channel_deliveries_24h' => $failedDeliveries24h,
        ]);
    }

    private function storage(): array
    {
        $disk = 'local';
        $probe = '.health/'.Str::uuid().'.probe';
        Storage::disk($disk)->put($probe, 'ok');
        $readable = Storage::disk($disk)->get($probe) === 'ok';
        Storage::disk($disk)->delete($probe);

        $free = @disk_free_space(storage_path());
        $total = @disk_total_space(storage_path());
        $freePct = ($free !== false && $total) ? round($free / $total * 100, 1) : null;

        $status = ! $readable ? 'major_outage' : (($freePct !== null && $freePct < 10) ? 'degraded' : 'operational');

        return $this->status('Document storage', $status, ['disk' => $disk, 'writable' => $readable, 'free_percent' => $freePct]);
    }

    /** A failing probe reports itself as an outage instead of breaking the whole health view. */
    private function guard(string $name, callable $probe): array
    {
        try {
            return $probe();
        } catch (Throwable $e) {
            report($e);

            return $this->status($name, 'major_outage', ['error' => class_basename($e)]);
        }
    }

    private function status(string $name, string $status, array $meta = []): array
    {
        return ['name' => $name, 'status' => $status, 'meta' => $meta];
    }
}
