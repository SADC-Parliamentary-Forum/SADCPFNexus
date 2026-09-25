<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\Hr\Import\HrVipImportService;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;

class ImportHrVipPackCommand extends Command
{
    protected $signature = 'hr:import-vip-pack
        {--tenant= : Tenant id (required)}
        {--directory= : Directory containing Sage VIP export files}
        {--commit : Commit staged import (default: stage only)}
        {--force : Allow commit}';

    protected $description = 'Stage (and optionally commit) a Sage VIP HR/leave/payroll export directory';

    public function handle(HrVipImportService $imports): int
    {
        $tenantId = $this->resolvedTenantId();
        if ($tenantId === false) {
            return self::FAILURE;
        }

        $dir = $this->option('directory');
        if (! is_string($dir) || ! is_dir($dir)) {
            $this->error('Provide --directory= with readable export files.');

            return self::FAILURE;
        }

        $actor = $this->systemAdmin($tenantId);
        if ($actor === null) {
            $this->error('No system admin found for tenant.');

            return self::FAILURE;
        }

        $uploads = [];
        foreach (scandir($dir) ?: [] as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            $path = $dir.'/'.$file;
            if (! is_file($path)) {
                continue;
            }
            $uploads[] = new UploadedFile($path, $file, mime_content_type($path) ?: null, null, true);
        }

        if ($uploads === []) {
            $this->error('No files found in directory.');

            return self::FAILURE;
        }

        $batch = $imports->createBatch($actor);
        $batch = $imports->ingest($batch, $uploads, $actor);
        $preview = $batch->preview ?? [];
        $this->info('Batch '.$batch->batch_number.' staged.');
        $this->line(json_encode($preview, JSON_PRETTY_PRINT));

        if ($this->option('commit')) {
            if (! $this->option('force')) {
                $this->error('Commit requires --force.');

                return self::FAILURE;
            }
            $batch = $imports->commit($batch, $actor);
            $this->info('Committed: '.json_encode($batch->commit_summary));
        }

        return self::SUCCESS;
    }

    private function resolvedTenantId(): int|false
    {
        $raw = $this->option('tenant');
        if ($raw === null || trim((string) $raw) === '') {
            $this->error('Provide --tenant=<id>.');

            return false;
        }
        $tenantId = (int) $raw;
        if (! Tenant::query()->whereKey($tenantId)->exists()) {
            $this->error('Tenant not found.');

            return false;
        }

        return $tenantId;
    }

    private function systemAdmin(int $tenantId): ?User
    {
        return User::query()
            ->where('tenant_id', $tenantId)
            ->get()
            ->first(fn (User $user) => $user->isSystemAdmin());
    }
}
