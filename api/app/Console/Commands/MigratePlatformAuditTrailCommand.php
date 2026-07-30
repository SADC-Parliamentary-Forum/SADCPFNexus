<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Modules\PlatformAudit\Services\EventTypeRegistryService;
use App\Modules\PlatformAudit\Services\LegacyAuditMigrationService;
use Illuminate\Console\Command;

class MigratePlatformAuditTrailCommand extends Command
{
    protected $signature = 'audit-trail:migrate-legacy {--tenant=} {--limit=5000}';

    protected $description = 'Migrate historical audit_logs into platform audit_events (Migrated-* statuses; no fabricated IP/session)';

    public function handle(LegacyAuditMigrationService $migration, EventTypeRegistryService $registry): int
    {
        $registry->ensureSeeded();
        $tenantId = $this->option('tenant');
        $limit = (int) $this->option('limit');

        $tenants = $tenantId
            ? Tenant::query()->where('id', $tenantId)->get()
            : Tenant::query()->orderBy('id')->get();

        foreach ($tenants as $tenant) {
            $stats = $migration->migrateTenant((int) $tenant->id, $limit);
            $this->info("Tenant {$tenant->id}: ".json_encode($stats));
        }

        return self::SUCCESS;
    }
}
