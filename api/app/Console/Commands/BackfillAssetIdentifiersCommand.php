<?php

namespace App\Console\Commands;

use App\Models\Asset;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Modules\Assets\Import\AssetDescriptionParser;
use App\Modules\Assets\Import\NexusAssetTemplateParser;
use App\Modules\Assets\Import\NexusAssetTemplateWorkbook;
use App\Modules\Assets\Services\AssetTimelineService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillAssetIdentifiersCommand extends Command
{
    protected $signature = 'assets:backfill-identifiers
        {--tenant= : Tenant id (defaults to the only tenant)}
        {--file= : Nexus template workbook with a description column (defaults to the official 31 March 2026 listing)}
        {--apply : Write the values; without it the command only reports}';

    protected $description = 'Fill in missing serial numbers, models and makes from the FAR descriptions, and take "S/N …" out of asset names (dry run unless --apply)';

    public function handle(NexusAssetTemplateParser $parser, AssetDescriptionParser $descriptions, AssetTimelineService $timeline): int
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
            $tag = strtoupper(trim((string) ($record['asset_tag'] ?? '')));
            $text = trim((string) (($record['legacy_description'] ?? null) ?: ($record['asset_name'] ?? '')));
            if ($tag === '' || $text === '') {
                continue;
            }
            $parsed = $descriptions->parse($text);
            $source[$tag] = [
                'serial_number' => ($record['serial_number'] ?? null) ?: $parsed['serial'],
                'model' => ($record['model'] ?? null) ?: $parsed['model'],
                'manufacturer' => ($record['make'] ?? null) ?: $parsed['make'],
            ];
        }

        $assets = Asset::query()->where('tenant_id', $tenantId)->orderBy('id')->get();
        $takenSerials = $assets->pluck('serial_number')->filter()->map(fn ($s) => strtoupper(trim((string) $s)))->flip();

        $changes = [];
        foreach ($assets as $asset) {
            $set = [];
            $found = $source[$this->tagOf($asset)] ?? null;
            if ($found !== null) {
                foreach (['serial_number', 'model', 'manufacturer'] as $field) {
                    $value = trim((string) $found[$field]);
                    if ($value === '' || trim((string) $asset->{$field}) !== '') {
                        continue;
                    }
                    // Never give two assets the same serial; leave the clash for a person to resolve.
                    if ($field === 'serial_number' && isset($takenSerials[strtoupper($value)])) {
                        $this->line("  skip serial {$value} for {$this->tagOf($asset)}: already on another asset");

                        continue;
                    }
                    $set[$field] = $value;
                }
            }
            // The serial prints on its own label line, so it does not belong in the name too.
            $name = (string) $asset->name;
            $cleanName = $descriptions->withoutSerial($name);
            if ($cleanName !== $name) {
                $set['name'] = $cleanName;
            }
            if ($set !== []) {
                $changes[$asset->id] = [$asset, $set];
                if (isset($set['serial_number'])) {
                    $takenSerials[strtoupper($set['serial_number'])] = true;
                }
            }
        }

        $count = fn (string $field) => collect($changes)->filter(fn ($c) => isset($c[1][$field]))->count();
        $this->info("Tenant {$tenantId}: {$assets->count()} asset(s); from ".basename($path).": {$count('serial_number')} serial(s), {$count('model')} model(s), {$count('manufacturer')} make(s) to fill, {$count('name')} name(s) to clean.");
        foreach ($changes as [$asset, $set]) {
            $verb = $this->option('apply') ? 'set' : 'would set';
            $this->line("  {$verb} {$this->tagOf($asset)}: ".json_encode($set, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        if (! $this->option('apply')) {
            $this->warn('Dry run: nothing written. Re-run with --apply to save these values.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($changes, $tenantId, $timeline) {
            foreach ($changes as [$asset, $set]) {
                $asset->fill($set);
                $asset->save();
                $timeline->record($asset, 'IDENTIFIERS_BACKFILLED', 'Updated '.implode(', ', array_keys($set)).' from the FAR description');
            }
            AuditLog::record('assets.identifiers_backfilled', [
                'tenant_id' => $tenantId,
                'new_values' => ['tenant_id' => $tenantId, 'count' => count($changes)],
                'tags' => 'assets',
            ]);
        });
        $this->info('Updated '.count($changes).' asset(s).');

        return self::SUCCESS;
    }

    private function tagOf(Asset $asset): string
    {
        return strtoupper(trim((string) ($asset->tag_number ?: $asset->asset_code)));
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
