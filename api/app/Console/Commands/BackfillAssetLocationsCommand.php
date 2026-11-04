<?php

namespace App\Console\Commands;

use App\Models\Asset;
use App\Models\AssetLabelTemplate;
use App\Models\AssetLocation;
use App\Models\AssetLocationMapping;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Modules\Assets\Import\NexusAssetTemplateParser;
use App\Modules\Assets\Import\NexusAssetTemplateWorkbook;
use App\Modules\Assets\Services\AssetTimelineService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillAssetLocationsCommand extends Command
{
    protected $signature = 'assets:backfill-locations
        {--tenant= : Tenant id (defaults to the only tenant)}
        {--file= : Nexus template workbook with a location column (defaults to the official 31 March 2026 listing)}
        {--apply : Write the locations; without it the command only reports}';

    protected $description = 'Fill in missing asset locations from the official FAR listing (dry run unless --apply)';

    public function handle(NexusAssetTemplateParser $parser, AssetTimelineService $timeline): int
    {
        $tenantId = $this->tenantId();
        if ($tenantId === null) {
            return self::FAILURE;
        }

        $path = (string) ($this->option('file') ?: NexusAssetTemplateWorkbook::officialPath());
        if (! is_file($path)) {
            $this->error("Workbook not found: {$path}");

            return self::FAILURE;
        }

        $source = [];
        foreach ($parser->parseFile($path, basename($path)) as $record) {
            $location = trim((string) ($record['legacy_location'] ?? ''));
            if (! empty($record['asset_tag']) && $location !== '') {
                $source[$record['asset_tag']] = $location;
            }
        }

        $assets = Asset::query()->where('tenant_id', $tenantId)->get();
        $missing = $assets->filter(fn (Asset $a) => $a->location_id === null && trim((string) $a->legacy_location) === '');
        $fillable = $missing->filter(fn (Asset $a) => isset($source[$this->tagOf($a)]));

        $this->info("Tenant {$tenantId}: {$assets->count()} asset(s), {$missing->count()} without a location, {$fillable->count()} fillable from ".basename($path).'.');
        foreach ($missing->diffKeys($fillable) as $asset) {
            $this->line("  not in listing: {$this->tagOf($asset)} {$asset->name}");
        }
        $this->reportTemplates($tenantId);

        if (! $this->option('apply')) {
            foreach ($fillable as $asset) {
                $this->line("  would set {$this->tagOf($asset)} -> {$source[$this->tagOf($asset)]}");
            }
            $this->warn('Dry run: nothing written. Re-run with --apply to fill these locations.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($fillable, $source, $tenantId, $timeline) {
            foreach ($fillable as $asset) {
                $legacy = $source[$this->tagOf($asset)];
                $asset->legacy_location = $legacy;
                $asset->location_id = $this->existingLocationId($tenantId, $legacy);
                $asset->save();
                $timeline->record($asset, 'LOCATION_BACKFILLED', 'Location set to '.$legacy.' from the FAR listing');
                $this->line("  set {$this->tagOf($asset)} -> {$legacy}");
            }
            AuditLog::record('assets.locations_backfilled', [
                'tenant_id' => $tenantId,
                'new_values' => ['tenant_id' => $tenantId, 'count' => $fillable->count()],
                'tags' => 'assets',
            ]);
        });
        $this->info("Filled {$fillable->count()} location(s).");

        return self::SUCCESS;
    }

    private function tagOf(Asset $asset): string
    {
        return strtoupper(trim((string) ($asset->tag_number ?: $asset->asset_code)));
    }

    /** Reuse a location the import already mapped or created; otherwise the label prints the legacy name. */
    private function existingLocationId(int $tenantId, string $legacy): ?int
    {
        $mapped = AssetLocationMapping::query()
            ->where('tenant_id', $tenantId)
            ->where('legacy_location', $legacy)
            ->value('location_id');
        if ($mapped) {
            return (int) $mapped;
        }
        $id = AssetLocation::query()
            ->where('tenant_id', $tenantId)
            ->where(fn ($q) => $q->where('name', $legacy)->orWhere('legacy_name', $legacy))
            ->value('id');

        return $id ? (int) $id : null;
    }

    private function reportTemplates(int $tenantId): void
    {
        $templates = AssetLabelTemplate::query()->where('tenant_id', $tenantId)->orderBy('id')->get();
        foreach ($templates as $tpl) {
            $saved = is_array($tpl->layout) && $tpl->layout !== [] ? 'saved layout' : 'default layout';
            $this->line("  label template {$tpl->code}: {$tpl->label_width_mm}x{$tpl->label_height_mm} mm, {$saved}".($tpl->is_default ? ', default' : ''));
        }
    }

    private function tenantId(): ?int
    {
        $raw = trim((string) $this->option('tenant'));
        if ($raw === '') {
            $ids = Tenant::query()->pluck('id');
            if ($ids->count() !== 1) {
                $this->error('Several tenants exist; provide --tenant=<id>.');

                return null;
            }

            return (int) $ids->first();
        }
        if (! preg_match('/^[1-9][0-9]*$/', $raw) || ! Tenant::query()->whereKey((int) $raw)->exists()) {
            $this->error("Tenant {$raw} was not found.");

            return null;
        }

        return (int) $raw;
    }
}
