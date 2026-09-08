<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Modules\Procurement\Services\ProcurementInboxService;
use Illuminate\Console\Command;

class ProcurementPollInbox extends Command
{
    protected $signature = 'procurement:poll-inbox
        {--tenant= : Limit to a single tenant id}
        {--fixture= : JSON fixture path (intakes for review only; for tests / dry environments)}
        {--dry-run : Parse and count without persisting intakes}';

    protected $description = 'Poll the designated procurement invoice mailbox into document intakes for review (never auto-confirm)';

    public function handle(ProcurementInboxService $inbox): int
    {
        $tenantId = $this->option('tenant');
        $fixture = $this->option('fixture');
        $dryRun = (bool) $this->option('dry-run');

        $query = Tenant::query()->when($tenantId, fn ($q) => $q->where('id', $tenantId));
        $processed = 0;

        $query->each(function (Tenant $tenant) use ($inbox, $fixture, $dryRun, &$processed) {
            try {
                $result = $inbox->poll($tenant, [
                    'fixture' => $fixture,
                    'dry_run' => $dryRun,
                ]);
                $processed++;
                $this->info(sprintf(
                    'Tenant %d: status=%s imported=%d skipped=%d dry_run=%s',
                    $tenant->id,
                    $result['status'],
                    $result['imported'],
                    $result['skipped'],
                    $result['dry_run'] ? 'yes' : 'no'
                ));
                foreach ($result['errors'] as $error) {
                    $this->warn("  - {$error}");
                }
            } catch (\Throwable $e) {
                $this->error("Tenant {$tenant->id}: ".$e->getMessage());
            }
        });

        $this->info("Done. Tenants processed: {$processed}");

        return self::SUCCESS;
    }
}
