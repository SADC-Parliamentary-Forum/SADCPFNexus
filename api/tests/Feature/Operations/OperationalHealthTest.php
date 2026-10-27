<?php

namespace Tests\Feature\Operations;

use App\Modules\AdminConsole\Services\OperationalHealthService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Live operational probes behind the restricted admin operations console and
 * `php artisan ops:health`: scheduler heartbeat, database, queue failures,
 * notification backlog and storage — measured, never hard-coded.
 */
class OperationalHealthTest extends TestCase
{
    private function probes(): array
    {
        return app(OperationalHealthService::class)->probes();
    }

    public function test_scheduler_status_follows_the_heartbeat(): void
    {
        Cache::forget(OperationalHealthService::HEARTBEAT_KEY);
        $this->assertSame('unknown', $this->probes()['scheduler']['status']);

        OperationalHealthService::recordHeartbeat();
        $this->assertSame('operational', $this->probes()['scheduler']['status']);

        Cache::forever(OperationalHealthService::HEARTBEAT_KEY, now()->subMinutes(30)->toIso8601String());
        $scheduler = $this->probes()['scheduler'];
        $this->assertSame('major_outage', $scheduler['status']);
        $this->assertGreaterThanOrEqual(1700, $scheduler['meta']['age_seconds']);
    }

    public function test_recent_failed_jobs_degrade_the_queue_probe(): void
    {
        $this->assertSame(0, $this->probes()['queue_worker']['meta']['failed_jobs_24h']);

        DB::table('failed_jobs')->insert([
            'uuid' => (string) Str::uuid(),
            'connection' => 'redis', 'queue' => 'notifications',
            'payload' => '{}', 'exception' => 'RuntimeException: test', 'failed_at' => now(),
        ]);

        $queue = $this->probes()['queue_worker'];
        $this->assertSame('degraded', $queue['status']);
        $this->assertSame(1, $queue['meta']['failed_jobs_24h']);
    }

    public function test_database_probe_is_measured(): void
    {
        $db = $this->probes()['database'];
        $this->assertSame('operational', $db['status']);
        $this->assertIsInt($db['meta']['latency_ms']);
        $this->assertSame('pgsql', $db['meta']['db_driver']);
    }

    public function test_admin_console_shows_live_probes_and_is_restricted(): void
    {
        OperationalHealthService::recordHeartbeat();
        $admin = $this->makeAdmin();

        $services = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/platform-status')->assertOk()->json('data.services');
        foreach (['scheduler', 'database', 'queue_worker', 'notification_delivery', 'storage'] as $key) {
            $this->assertArrayHasKey($key, $services, "missing live probe {$key}");
        }
        $this->assertSame('operational', $services['scheduler']['status']);

        $this->actingAs($this->makeUser('staff'), 'sanctum')->getJson('/api/v1/admin/platform-status')->assertForbidden();
    }

    public function test_ops_health_command_reports_every_probe_as_json(): void
    {
        OperationalHealthService::recordHeartbeat();

        Artisan::call('ops:health', ['--json' => true]);
        $report = json_decode(Artisan::output(), true);

        $this->assertSame(['scheduler', 'database', 'queue_worker', 'notification_delivery', 'storage'], array_keys($report));
    }
}
