<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\Assets\Import\NexusAssetTemplateWorkbook;
use App\Modules\Assets\Services\AssetImportCommitService;
use App\Modules\Assets\Services\AssetImportService;
use App\Modules\Assets\Services\AssetRegisterClearService;
use Database\Seeders\AssetCategorySeeder;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;

class ReplaceAssetRegisterCommand extends Command
{
    protected $signature = 'assets:replace-register
        {--tenant= : Tenant id (required)}
        {--file= : Path to a Nexus template workbook (defaults to the official 31 March 2026 listing)}
        {--force : Wipe the current register and commit the uploaded listing}';

    protected $description = 'Clear the asset register and replace it with a Nexus template workbook (official FAR listing by default)';

    public function handle(
        AssetRegisterClearService $clear,
        AssetImportService $imports,
        AssetImportCommitService $commits,
    ): int {
        if (! $this->option('force')) {
            $this->error('Refusing to replace the asset register without --force.');

            return self::FAILURE;
        }

        $tenantId = $this->resolvedTenantId();
        if ($tenantId === false) {
            return self::FAILURE;
        }

        $path = $this->resolvedFile();
        if ($path === false) {
            return self::FAILURE;
        }

        $admin = $this->systemAdmin($tenantId);
        if ($admin === null) {
            $this->error("Tenant {$tenantId} has no System Admin to own the import.");

            return self::FAILURE;
        }

        $this->call('db:seed', [
            '--class' => AssetCategorySeeder::class,
            '--force' => true,
        ]);

        $cleared = $clear->clear($tenantId, function (string $table, int $deleted): void {
            $this->line("Deleted {$deleted} row(s) from {$table}");
        }, $admin);
        $this->info("Register cleared (was {$cleared['before']} asset(s)). Importing {$path}");

        $upload = new UploadedFile(
            $path,
            basename($path),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true,
        );
        $batch = $imports->ingest(['template' => $upload], $admin, 'template');
        $approved = $imports->approve($batch, $admin, [], true);
        $this->info("Staged batch {$batch->batch_number}: {$batch->parsed_row_count} row(s), approved {$approved}.");

        $commits->commit($batch->fresh(), $admin, false);
        $remaining = \App\Models\Asset::query()->where('tenant_id', $tenantId)->count();
        $this->info("Register replaced. Assets remaining: {$remaining}.");

        return self::SUCCESS;
    }

    private function resolvedTenantId(): int|false
    {
        $raw = $this->option('tenant');
        if ($raw === null || $raw === false || $raw === '') {
            $this->error('Provide --tenant=<id>.');

            return false;
        }
        $normalized = trim((string) $raw);
        if (! preg_match('/^[1-9][0-9]*$/', $normalized)) {
            $this->error('Invalid --tenant. Provide a positive integer tenant id.');

            return false;
        }
        $tenantId = (int) $normalized;
        if (! Tenant::query()->whereKey($tenantId)->exists()) {
            $this->error("Tenant {$tenantId} was not found.");

            return false;
        }

        return $tenantId;
    }

    private function resolvedFile(): string|false
    {
        $raw = $this->option('file');
        $path = is_string($raw) && trim($raw) !== ''
            ? trim($raw)
            : NexusAssetTemplateWorkbook::officialPath();
        if (! is_file($path)) {
            $this->error("Import workbook not found: {$path}");

            return false;
        }

        return $path;
    }

    private function systemAdmin(int $tenantId): ?User
    {
        return User::query()
            ->where('tenant_id', $tenantId)
            ->get()
            ->first(fn (User $user): bool => $user->isSystemAdmin());
    }
}
