<?php

namespace App\Console\Commands;

use App\Modules\AdminConsole\Services\OperationalHealthService;
use Illuminate\Console\Command;

/**
 * Operational health for monitoring/cron/container healthchecks.
 * Exit 0 = all probes operational (or only unknown when --allow-unknown),
 * 1 = degraded, 2 = an outage. Counts only; never prints payloads.
 */
class OpsHealth extends Command
{
    protected $signature = 'ops:health
        {--json : Print machine-readable JSON}
        {--allow-unknown : Treat probes with no data yet (e.g. first scheduler minute) as healthy}';

    protected $description = 'Report scheduler heartbeat, database, queues, notification delivery and storage health';

    public function handle(OperationalHealthService $health): int
    {
        $probes = $health->probes();

        if ($this->option('json')) {
            $this->line(json_encode($probes, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->table(['Probe', 'Status', 'Details'], collect($probes)->map(fn (array $p) => [
                $p['name'],
                $p['status'],
                json_encode($p['meta'], JSON_UNESCAPED_SLASHES),
            ])->values()->all());
        }

        $statuses = collect($probes)->pluck('status');
        if ($statuses->contains('major_outage')) {
            return 2;
        }
        if ($statuses->contains('degraded') || (! $this->option('allow-unknown') && $statuses->contains('unknown'))) {
            return 1;
        }

        return 0;
    }
}
