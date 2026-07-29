<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Modules\Correspondence\Services\CorrespondenceMailboxService;
use Illuminate\Console\Command;

class CorrespondencePollMailbox extends Command
{
    protected $signature = 'correspondence:poll-mailbox
        {--tenant= : Limit to a single tenant id}
        {--fixture= : JSON fixture path (suggestions only; for tests / dry environments)}
        {--dry-run : Parse and count without persisting suggestions}';

    protected $description = 'Poll the designated registry mailbox into correspondence suggestions only (never auto-register)';

    public function handle(CorrespondenceMailboxService $mailbox): int
    {
        $tenantId = $this->option('tenant');
        $fixture = $this->option('fixture');
        $dryRun = (bool) $this->option('dry-run');

        $query = Tenant::query()->when($tenantId, fn ($q) => $q->where('id', $tenantId));
        $processed = 0;

        $query->each(function (Tenant $tenant) use ($mailbox, $fixture, $dryRun, &$processed) {
            try {
                $result = $mailbox->pollMailbox((int) $tenant->id, [
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
