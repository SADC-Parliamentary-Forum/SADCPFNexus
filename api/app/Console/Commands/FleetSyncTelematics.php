<?php

namespace App\Console\Commands;

use App\Modules\Fleet\Telematics\TelematicsSyncService;
use Illuminate\Console\Command;

class FleetSyncTelematics extends Command
{
    protected $signature = 'fleet:sync-telematics
        {--tenant= : Limit to a single tenant id}
        {--fixture= : JSON fixture path (documented positions shape; for tests / dry environments)}
        {--dry-run : Fetch and map without persisting GPS updates}';

    protected $description = 'Sync last-known positions from the configured fleet telematics provider into GPS stub fields';

    public function handle(TelematicsSyncService $sync): int
    {
        $result = $sync->sync([
            'tenant' => $this->option('tenant'),
            'fixture' => $this->option('fixture'),
            'dry_run' => (bool) $this->option('dry-run'),
        ]);

        $this->info(sprintf(
            'Telematics sync: status=%s driver=%s updated=%d skipped=%d dry_run=%s',
            $result['status'],
            $result['driver'],
            $result['updated'],
            $result['skipped'],
            $result['dry_run'] ? 'yes' : 'no'
        ));

        foreach ($result['errors'] as $error) {
            $this->warn("  - {$error}");
        }

        return $result['status'] === 'error' ? self::FAILURE : self::SUCCESS;
    }
}
