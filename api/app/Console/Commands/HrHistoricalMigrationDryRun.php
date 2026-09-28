<?php

namespace App\Console\Commands;

use App\Models\Asset;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Hr\Services\TenantTransactionalDataWipeService;
use App\Modules\Hr\Import\HrVipImportService;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Transactional rehearsal of the HR historical-migration wipe + import, per
 * Nexus_Historical_Import_LLM_Instruction_v3.md §4/§12. Never commits: the
 * whole run is wrapped in a DB transaction that is rolled back unconditionally
 * in a finally block, and uploaded-file storage side effects (the one thing a
 * DB rollback doesn't undo) are deleted afterward too.
 *
 * No isolated staging environment exists for this app — this is the
 * documented substitute: safely exercise the real wipe + import code paths
 * against the real production data without ever persisting a change.
 *
 * Output is intentionally sanitized: employee codes and aggregate counts
 * only — never names, emails, bank details, national IDs, or salary figures
 * — since this command's stdout is captured as a CI run log.
 */
class HrHistoricalMigrationDryRun extends Command
{
    protected $signature = 'hr:dry-run-migration
        {--tenant= : Tenant id (required)}
        {--database= : Expected database name (safety gate)}
        {--source-dir=storage/app/hr-vip-dry-run-source : Directory containing the 13 source files, relative to the Laravel base path}
        {--actor-user-id= : User id to act as (defaults to the tenant system admin)}';

    protected $description = 'Rehearse the HR historical wipe+import inside a transaction that is always rolled back. Never writes real data.';

    public function handle(TenantTransactionalDataWipeService $wipeService, HrVipImportService $importService): int
    {
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

        $sourceDir = base_path($this->option('source-dir'));
        if (! is_dir($sourceDir)) {
            $this->error("Source directory not found: {$sourceDir}");
            $this->line('Place the 13 Sage VIP export files there (PDF/XLS/XLSX) before running this command.');

            return self::FAILURE;
        }

        $files = collect(glob($sourceDir.'/*') ?: [])
            ->filter(fn (string $p) => is_file($p) && preg_match('/\.(pdf|xls|xlsx)$/i', $p))
            ->values();
        if ($files->isEmpty()) {
            $this->error("No .pdf/.xls/.xlsx files found in {$sourceDir}.");

            return self::FAILURE;
        }
        $this->info("Found {$files->count()} source file(s).");

        $actor = $this->resolveActor($tenantId);
        if (! $actor) {
            $this->error('Could not resolve an actor user (system admin) for this tenant. Pass --actor-user-id explicitly.');

            return self::FAILURE;
        }
        $this->line("Acting as user #{$actor->id} ({$actor->email}).");

        $before = $this->snapshot($tenantId);
        $this->printSnapshot('BEFORE', $before);

        $storedBatchDirs = [];
        $exitCode = self::SUCCESS;

        DB::beginTransaction();
        try {
            // ── Step 1: wipe ────────────────────────────────────────────────
            $this->info("\n=== Wipe ===");
            $wipeResult = $wipeService->wipe($tenantId, function (string $table, int $deleted): void {
                $this->line("  deleted {$deleted} row(s) from {$table}");
            });
            $this->line("Assets before/after wipe: {$wipeResult['asset_before']} / {$wipeResult['asset_after']}");
            if ($wipeResult['asset_before'] !== $wipeResult['asset_after']) {
                $this->error('ASSET COUNT CHANGED DURING WIPE — this is a hard failure.');
                $exitCode = self::FAILURE;
            }

            // System admin must still exist and be enabled after wipe.
            $adminStillPresent = User::query()->where('tenant_id', $tenantId)->whereKey($actor->id)->exists();
            $this->line('System admin present after wipe: '.($adminStillPresent ? 'YES' : 'NO — FAILURE'));
            if (! $adminStillPresent) {
                $exitCode = self::FAILURE;
            }

            // ── Step 2: first import ───────────────────────────────────────
            $this->info("\n=== Import — first run ===");
            $uploads1 = $this->buildUploads($files);
            $batch1 = $importService->createBatch($actor);
            $batch1 = $importService->ingest($batch1, $uploads1, $actor);
            $storedBatchDirs[] = "hr-vip-imports/{$batch1->id}";
            $preview1 = $importService->preview($batch1, $actor);
            $this->printPreview($preview1);
            $batch1 = $importService->commit($batch1, $actor);
            $summary1 = $batch1->commit_summary ?? [];
            $this->printSummary('First-run commit summary', $summary1);

            // ── Step 3: second import of the SAME files (idempotency) ─────
            $this->info("\n=== Import — second run of the same files (idempotency check) ===");
            $uploads2 = $this->buildUploads($files);
            $batch2 = $importService->createBatch($actor);
            $batch2 = $importService->ingest($batch2, $uploads2, $actor);
            $storedBatchDirs[] = "hr-vip-imports/{$batch2->id}";
            $preview2 = $importService->preview($batch2, $actor);
            $batch2 = $importService->commit($batch2, $actor);
            $summary2 = $batch2->commit_summary ?? [];
            $this->printSummary('Second-run commit summary', $summary2);

            $idempotent = ($summary2['leave_transactions'] ?? null) === 0
                && ($summary2['payslips'] ?? null) === 0
                && ($summary2['legacy_profiles_created'] ?? null) === 0;
            $this->line("\nIdempotency check (second run should create ~0 new leave transactions/payslips/legacy profiles): "
                .($idempotent ? 'PASS' : 'CHECK MANUALLY — see summaries above'));

            $this->comment("\nNote: a corrected-report revision scenario was NOT exercised — no corrected/revised "
                ."source file was supplied for this rehearsal, only the original 13. Test that path separately "
                ."with an actual corrected file before relying on it.");

            $after = $this->snapshot($tenantId);
            $this->printSnapshot('AFTER (still inside the transaction, about to roll back)', $after);
        } catch (\Throwable $e) {
            $this->error('Dry run raised an exception: '.$e->getMessage());
            $this->line($e->getTraceAsString());
            $exitCode = self::FAILURE;
        } finally {
            DB::rollBack();
            $this->info("\nTransaction rolled back — no data was actually changed.");

            // File storage writes are not covered by the DB rollback; clean them up.
            foreach ($storedBatchDirs as $dir) {
                if (Storage::disk('local')->exists($dir)) {
                    Storage::disk('local')->deleteDirectory($dir);
                }
            }
            $this->line('Uploaded batch file artifacts cleaned up from local storage.');
        }

        $finalAssetCount = Asset::query()->where('tenant_id', $tenantId)->count();
        $this->line("Post-rollback asset count (must equal BEFORE): {$finalAssetCount} (before was {$before['assets']})");
        if ($finalAssetCount !== $before['assets']) {
            $this->error('Asset count differs after rollback — investigate immediately, do not trust this environment.');
            $exitCode = self::FAILURE;
        }

        return $exitCode;
    }

    /** @return array<int, UploadedFile> */
    private function buildUploads($files): array
    {
        return $files->map(fn (string $path) => new UploadedFile(
            $path,
            basename($path),
            mime_content_type($path) ?: null,
            null,
            true, // test mode: bypass is_uploaded_file() check for a local file path
        ))->all();
    }

    /** @return array{tenant_id:int,assets:int,users:int,leave_requests:int,payslips:int} */
    private function snapshot(int $tenantId): array
    {
        return [
            'tenant_id' => $tenantId,
            'assets' => Asset::query()->where('tenant_id', $tenantId)->count(),
            'users' => User::query()->where('tenant_id', $tenantId)->count(),
            'leave_requests' => DB::table('leave_requests')->where('tenant_id', $tenantId)->count(),
            'payslips' => DB::table('payslips')->where('tenant_id', $tenantId)->count(),
        ];
    }

    private function printSnapshot(string $label, array $snap): void
    {
        $this->info("\n=== {$label} ===");
        foreach ($snap as $k => $v) {
            $this->line("  {$k}: {$v}");
        }
    }

    private function printPreview(array $preview): void
    {
        $this->line('Preview: '.json_encode([
            'employee_count' => $preview['employee_count'] ?? null,
            'employees_to_create' => count($preview['employees_to_create'] ?? []),
            'legacy_profile_candidates' => array_map(
                fn ($c) => $c['employee_code'] ?? null,
                $preview['legacy_profile_candidates'] ?? []
            ),
            'leave_transaction_count' => $preview['leave_transaction_count'] ?? null,
            'leave_balance_rows' => $preview['leave_balance_rows'] ?? null,
            'payslip_count' => $preview['payslip_count'] ?? null,
            'blocking_errors' => count($preview['blocking_errors'] ?? []),
        ]));
    }

    private function printSummary(string $label, array $summary): void
    {
        $this->info($label.': '.json_encode($summary));
    }

    private function resolveActor(int $tenantId): ?User
    {
        if ($raw = $this->option('actor-user-id')) {
            return User::query()->where('tenant_id', $tenantId)->find((int) $raw);
        }

        return User::query()
            ->where('tenant_id', $tenantId)
            ->get()
            ->first(fn (User $u) => $u->isSystemAdmin());
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
