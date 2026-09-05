<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\Assets\Services\AssetImportCommitService;
use App\Modules\Assets\Services\AssetImportService;
use App\Modules\Assets\Services\AssetReconciliationReportService;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;

class ImportLegacyAssetRegisterCommand extends Command
{
    protected $signature = 'assets:import-legacy
        {--tenant= : Tenant id}
        {--user= : User id that records the import}
        {--commit : Approve non-blocking rows and commit}
        {--report : Write the reconciliation markdown}
        {--category= : Path to category Crystal XLS}
        {--location= : Path to location Crystal XLS}
        {--staging= : Path to staging XLSX}';

    protected $description = 'Ingest the SADC PF Crystal asset listings into an import batch';

    public function handle(
        AssetImportService $imports,
        AssetImportCommitService $commits,
        AssetReconciliationReportService $reports,
    ): int {
        $tenant = $this->option('tenant')
            ? Tenant::findOrFail($this->option('tenant'))
            : Tenant::query()->orderBy('id')->first();
        if (! $tenant) {
            $this->error('No tenant found.');

            return self::FAILURE;
        }
        $user = $this->option('user')
            ? User::findOrFail($this->option('user'))
            : User::query()->where('tenant_id', $tenant->id)->orderBy('id')->first();
        if (! $user) {
            $this->error('No user found.');

            return self::FAILURE;
        }

        $base = base_path('tests/Fixtures/asset-register');
        $files = [];
        $map = [
            'category' => $this->option('category') ?: $base.'/2036_Fixed_Assets_Listing_Category_31_March_2026.xls',
            'location' => $this->option('location') ?: $base.'/2026_Fixed_Assets_Listing_Location_31_March_2026.xls',
            'staging' => $this->option('staging') ?: $base.'/Nexus_Asset_Register_Import_Staging.xlsx',
        ];
        foreach ($map as $role => $path) {
            if (! is_readable($path)) {
                $this->warn("Missing {$role} file: {$path}");

                continue;
            }
            $files[$role] = new UploadedFile($path, basename($path), null, null, true);
        }

        $batch = $imports->ingest($files, $user, 'legacy');
        $this->info('Batch '.$batch->batch_number.' status='.$batch->status.' unique_tags='.$batch->unique_tag_count);

        if ($this->option('commit')) {
            $result = $commits->commit($batch->fresh(), $user, true);
            $batch = $result['batch'];
            $this->info('Committed status='.$batch->status);
        }

        $report = $reports->build($batch->fresh());
        if ($this->option('report')) {
            $path = $reports->writeMarkdown($report);
            $this->info('Wrote '.$path);
        }
        $this->line($reports->toMarkdown($report));

        return ($report['equation']['balanced'] ?? false) ? self::SUCCESS : self::FAILURE;
    }
}
