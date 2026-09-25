<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Modules\Hr\Services\DatabaseBackupService;
use App\Modules\Hr\Services\TenantTransactionalDataWipeService;
use Illuminate\Console\Command;

class WipeTenantTransactionalDataCommand extends Command
{
    protected $signature = 'tenant:wipe-transactional-data
        {--tenant= : Tenant id (required)}
        {--database= : Expected database name (safety gate)}
        {--skip-backup : Skip pg_dump backup (not allowed on production)}
        {--force : Required to execute}';

    protected $description = 'Wipe HR/leave/payroll and related tenant transactional data while keeping the asset register and system admin logins';

    public function handle(
        TenantTransactionalDataWipeService $wipe,
        DatabaseBackupService $backup,
    ): int {
        if (! $this->option('force')) {
            $this->error('Refusing to wipe without --force.');

            return self::FAILURE;
        }

        $tenantId = $this->resolvedTenantId();
        if ($tenantId === false) {
            return self::FAILURE;
        }

        $expectedDb = $this->option('database');
        $actualDb = (string) config('database.connections.pgsql.database');
        if ($expectedDb !== null && $expectedDb !== '' && (string) $expectedDb !== $actualDb) {
            $this->error("Database name mismatch. Expected [{$expectedDb}] but connected to [{$actualDb}].");

            return self::FAILURE;
        }

        if (! $this->option('skip-backup')) {
            try {
                $meta = $backup->backupToStorage($actualDb);
                $this->info('Backup written: '.$meta['path'].' ('.$meta['size_bytes'].' bytes)');
            } catch (\Throwable $e) {
                $this->error('Backup failed — aborting wipe: '.$e->getMessage());

                return self::FAILURE;
            }
        }

        $result = $wipe->wipe($tenantId, function (string $table, int $deleted): void {
            $this->line("Deleted {$deleted} row(s) from {$table}");
        });

        $this->info("Wipe complete. Assets: {$result['asset_before']} → {$result['asset_after']} (must match).");

        if ($result['asset_before'] !== $result['asset_after']) {
            $this->error('Asset count changed during wipe — investigate immediately.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    private function resolvedTenantId(): int|false
    {
        $raw = $this->option('tenant');
        if ($raw === null || $raw === false || trim((string) $raw) === '') {
            $this->error('Provide --tenant=<id>.');

            return false;
        }

        $normalized = trim((string) $raw);
        if (! preg_match('/^[1-9][0-9]*$/', $normalized)) {
            $this->error('Invalid --tenant.');

            return false;
        }

        $tenantId = (int) $normalized;
        if (! Tenant::query()->whereKey($tenantId)->exists()) {
            $this->error("Tenant {$tenantId} was not found.");

            return false;
        }

        return $tenantId;
    }
}
