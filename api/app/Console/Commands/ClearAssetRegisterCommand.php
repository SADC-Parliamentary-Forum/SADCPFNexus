<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Modules\Assets\Services\AssetRegisterClearService;
use Illuminate\Console\Command;

class ClearAssetRegisterCommand extends Command
{
    protected $signature = 'assets:clear-register
        {--tenant= : Tenant id (default: all tenants)}
        {--force : Permanently delete register rows without prompting}';

    protected $description = 'Delete asset register rows (assets, custody, imports, labels) while keeping categories, locations, and numbering policies for a fresh bulk upload';

    public function handle(AssetRegisterClearService $clear): int
    {
        if (! $this->option('force')) {
            $this->error('Refusing to delete the asset register without --force.');

            return self::FAILURE;
        }

        $tenantId = $this->resolvedTenantId();
        if ($tenantId === false) {
            return self::FAILURE;
        }

        $result = $clear->clear($tenantId, function (string $table, int $deleted): void {
            $this->line("Deleted {$deleted} row(s) from {$table}");
        });

        $this->info("Asset register cleared. Assets remaining: {$result['after']} (was {$result['before']}). Categories and locations were kept.");

        return self::SUCCESS;
    }

    /**
     * @return int|null|false Null = all tenants; false = abort
     */
    private function resolvedTenantId(): int|false|null
    {
        $raw = $this->option('tenant');
        if ($raw === null || $raw === false || $raw === '') {
            return null;
        }

        $normalized = trim((string) $raw);
        if (! preg_match('/^[1-9][0-9]*$/', $normalized)) {
            $this->error('Invalid --tenant. Provide a positive integer tenant id, or omit --tenant to clear all tenants.');

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
