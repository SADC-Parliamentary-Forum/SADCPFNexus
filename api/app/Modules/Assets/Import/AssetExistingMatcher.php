<?php

namespace App\Modules\Assets\Import;

use App\Models\Asset;
use App\Models\AssetImportLineage;
use App\Models\AssetImportRaw;

/**
 * Finds an existing Nexus asset for a staged import row.
 *
 * Order: asset tag → unique serial → prior source-row fingerprint → exact
 * description + location + acquisition date. Never fuzzy-merges on similar text.
 */
final class AssetExistingMatcher
{
    /**
     * @param  array<string, mixed>  $merged
     * @param  list<array{record?: array<string, mixed>, raw_id?: int}>  $items
     */
    public function match(
        int $tenantId,
        string $tag,
        ?string $serial,
        array $merged,
        array $items,
        int $currentBatchId,
    ): ?Asset {
        $byTag = $this->matchTag($tenantId, $tag);
        if ($byTag) {
            return $byTag;
        }

        $bySerial = $this->matchUniqueSerial($tenantId, $serial);
        if ($bySerial) {
            return $bySerial;
        }

        $byFingerprint = $this->matchFingerprint($tenantId, $items, $currentBatchId);
        if ($byFingerprint) {
            return $byFingerprint;
        }

        return $this->matchExactDescriptionLocationDate($tenantId, $merged);
    }

    private function matchTag(int $tenantId, string $tag): ?Asset
    {
        $tag = strtoupper(trim($tag));
        if ($tag === '') {
            return null;
        }

        return Asset::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($tag) {
                $q->where('tag_number', $tag)->orWhere('asset_code', $tag);
            })
            ->first();
    }

    private function matchUniqueSerial(int $tenantId, ?string $serial): ?Asset
    {
        $serial = trim((string) $serial);
        if ($serial === '') {
            return null;
        }

        $matches = Asset::query()
            ->where('tenant_id', $tenantId)
            ->where('serial_number', $serial)
            ->limit(2)
            ->get();

        return $matches->count() === 1 ? $matches->first() : null;
    }

    /**
     * @param  list<array{record?: array<string, mixed>, raw_id?: int}>  $items
     */
    private function matchFingerprint(int $tenantId, array $items, int $currentBatchId): ?Asset
    {
        $fingerprints = [];
        foreach ($items as $item) {
            $rawId = (int) ($item['raw_id'] ?? 0);
            if ($rawId <= 0) {
                continue;
            }
            $raw = AssetImportRaw::query()->find($rawId);
            if ($raw?->row_fingerprint) {
                $fingerprints[] = $raw->row_fingerprint;
            }
        }
        $fingerprints = array_values(array_unique($fingerprints));
        if ($fingerprints === []) {
            return null;
        }

        $priorRawIds = AssetImportRaw::query()
            ->whereIn('row_fingerprint', $fingerprints)
            ->whereHas('batch', function ($q) use ($tenantId, $currentBatchId) {
                $q->where('tenant_id', $tenantId)->where('id', '!=', $currentBatchId);
            })
            ->pluck('id');
        if ($priorRawIds->isEmpty()) {
            return null;
        }

        $tags = AssetImportLineage::query()
            ->whereIn('raw_id', $priorRawIds)
            ->pluck('asset_tag')
            ->filter()
            ->unique()
            ->values();
        if ($tags->count() !== 1) {
            return null;
        }

        return $this->matchTag($tenantId, (string) $tags->first());
    }

    /**
     * @param  array<string, mixed>  $merged
     */
    private function matchExactDescriptionLocationDate(int $tenantId, array $merged): ?Asset
    {
        $description = trim((string) ($merged['legacy_description'] ?? ''));
        $location = trim((string) ($merged['legacy_location'] ?? ''));
        $date = $merged['acquisition_date'] ?? null;
        if ($date instanceof \DateTimeInterface) {
            $date = $date->format('Y-m-d');
        } else {
            $date = trim((string) $date);
        }
        if ($description === '' || $location === '' || $date === '') {
            return null;
        }

        $matches = Asset::query()
            ->where('tenant_id', $tenantId)
            ->where('legacy_description', $description)
            ->where('legacy_location', $location)
            ->whereDate('purchase_date', $date)
            ->limit(2)
            ->get();

        return $matches->count() === 1 ? $matches->first() : null;
    }
}
