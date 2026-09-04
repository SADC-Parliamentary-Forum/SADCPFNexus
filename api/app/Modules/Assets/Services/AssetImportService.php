<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetCustodianMapping;
use App\Models\AssetImportBatch;
use App\Models\AssetImportDiscrepancy;
use App\Models\AssetImportLineage;
use App\Models\AssetImportRaw;
use App\Models\AssetImportStaging;
use App\Models\AssetLocation;
use App\Models\AssetLocationMapping;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Import\AssetCategoryMapper;
use App\Modules\Assets\Import\AssetDescriptionParser;
use App\Modules\Assets\Import\CrystalAssetListingParser;
use App\Modules\Assets\Import\NexusAssetTemplateParser;
use App\Modules\Assets\Import\StagingWorkbookParser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AssetImportService
{
    public function __construct(
        private readonly CrystalAssetListingParser $crystal,
        private readonly StagingWorkbookParser $stagingParser,
        private readonly NexusAssetTemplateParser $templateParser,
        private readonly AssetDescriptionParser $descriptions,
    ) {}

    /**
     * @param  array<string, UploadedFile|null>  $files  keys: category, location, staging, template
     */
    public function ingest(array $files, User $user, string $mode = 'legacy'): AssetImportBatch
    {
        $this->assertCanImport($user);

        $uploads = [];
        foreach ($files as $role => $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }
            $contents = file_get_contents($file->getRealPath() ?: '');
            $uploads[$role] = [
                'file' => $file,
                'name' => $file->getClientOriginalName(),
                'hash' => hash('sha256', $contents !== false ? $contents : ''),
                'path' => $file->getRealPath(),
            ];
        }
        if ($uploads === []) {
            throw ValidationException::withMessages(['files' => 'Upload at least one source file.']);
        }

        $hashes = [];
        $names = [];
        foreach ($uploads as $role => $meta) {
            $hashes[$role] = $meta['hash'];
            $names[$role] = $meta['name'];
        }
        ksort($hashes);
        $fingerprint = hash('sha256', json_encode($hashes).'|'.$user->tenant_id);

        $existing = AssetImportBatch::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('fingerprint', $fingerprint)
            ->whereIn('status', ['review', 'committing', 'committed', 'incomplete', 'parsed'])
            ->latest('id')
            ->first();
        if ($existing && $existing->status === 'committed') {
            return $existing;
        }
        if ($existing && in_array($existing->status, ['review', 'parsed', 'incomplete'], true)) {
            return $existing->fresh(['stagingRows']);
        }

        return DB::transaction(function () use ($uploads, $user, $mode, $names, $hashes, $fingerprint) {
            $batch = AssetImportBatch::create([
                'tenant_id' => $user->tenant_id,
                'batch_number' => $this->nextBatchNumber($user->tenant_id),
                'mode' => $mode,
                'filenames' => $names,
                'file_hashes' => $hashes,
                'fingerprint' => $fingerprint,
                'uploaded_by' => $user->id,
                'uploaded_at' => now(),
                'status' => 'uploaded',
            ]);

            $parsed = [];
            $sourceRows = 0;
            foreach ($uploads as $role => $meta) {
                if (in_array($role, ['category', 'location'], true)) {
                    $result = $this->crystal->parseFile($meta['path'], $meta['name']);
                    $sourceRows += count($result['records']) + count($result['skipped']);
                    foreach ($result['records'] as $record) {
                        $raw = $this->storeRaw($batch, $record);
                        $parsed[] = ['record' => $record, 'raw_id' => $raw->id];
                    }
                } elseif ($role === 'staging') {
                    $result = $this->stagingParser->parseFile($meta['path'], $meta['name']);
                    $sourceRows += count($result['records']);
                    foreach ($result['records'] as $record) {
                        $raw = $this->storeRaw($batch, $record);
                        $parsed[] = ['record' => $record, 'raw_id' => $raw->id];
                    }
                    $this->seedSuggestedMappings($batch, $user, $result['location_mappings'] ?? []);
                } elseif ($role === 'template') {
                    $records = $this->templateParser->parseFile($meta['path'], $meta['name']);
                    $sourceRows += count($records);
                    foreach ($records as $record) {
                        $raw = $this->storeRaw($batch, $record);
                        $parsed[] = ['record' => $record, 'raw_id' => $raw->id];
                    }
                }
            }

            $batch->source_row_count = $sourceRows;
            $batch->parsed_row_count = count($parsed);
            $batch->status = 'reconciling';
            $batch->save();

            $this->reconcile($batch, $user, $parsed);
            $this->validate($batch, $user);

            $batch->status = 'review';
            $batch->save();

            AuditLog::record('assets.import_ingested', [
                'auditable_type' => AssetImportBatch::class,
                'auditable_id' => $batch->id,
                'new_values' => ['batch_number' => $batch->batch_number, 'parsed' => $batch->parsed_row_count],
                'tags' => 'assets',
            ]);

            return $batch->fresh();
        });
    }

    public function preview(AssetImportBatch $batch, User $user): array
    {
        $this->assertTenant($batch, $user);
        $rows = $batch->stagingRows()->get();
        $counts = [
            'total_source_records' => (int) $batch->source_row_count,
            'parsed_rows' => (int) $batch->parsed_row_count,
            'unique_asset_tags' => $rows->pluck('asset_tag')->filter()->unique()->count(),
            'ready_to_import' => $rows->where('review_status', 'approved')->where('proposed_action', 'CREATE')->count(),
            'already_exists' => $rows->where('proposed_action', 'UPDATE')->count()
                + $rows->where('proposed_action', 'NO_CHANGE')->count(),
            'ready_to_update' => $rows->where('proposed_action', 'UPDATE')->where('review_status', 'approved')->count(),
            'missing_asset_tag' => $rows->filter(fn ($r) => empty($r->asset_tag))->count(),
            'missing_serial' => $rows->filter(fn ($r) => empty($r->serial_number))->count(),
            'missing_model' => $rows->filter(fn ($r) => empty($r->model))->count(),
            'missing_location' => $rows->filter(fn ($r) => empty($r->legacy_location) && empty($r->location_id))->count(),
            'unmapped_custodian' => $rows->filter(fn ($r) => empty($r->custodian_user_id) && empty($r->custodian_department_id))->count(),
            'duplicate_asset_tags' => $rows->filter(function ($r) {
                return in_array('DUPLICATE_ASSET_TAG', $r->blocking_errors ?? [], true)
                    || in_array('ASSET_TAG_CONFLICT', $r->data_quality_flags ?? [], true);
            })->count(),
            'serial_conflicts' => $rows->filter(fn ($r) => in_array('DUPLICATE_SERIAL', $r->data_quality_flags ?? [], true))->count(),
            'financial_discrepancies' => $batch->discrepancies()
                ->where(function ($q) {
                    $q->where('field', 'like', '%cost%')->orWhere('field', 'like', '%book%');
                })
                ->count(),
            'other_warnings' => (int) $batch->warning_count,
            'blocking_errors' => $rows->where('blocking', true)->count(),
            'excluded' => $rows->where('review_status', 'excluded')->count(),
            'pending_review' => $rows->where('review_status', 'pending')->count(),
        ];

        return [
            'batch' => $batch,
            'counts' => $counts,
            'equation' => $this->equation($batch),
            'location_mappings' => AssetLocationMapping::query()->where('tenant_id', $user->tenant_id)->orderBy('legacy_location')->get(),
            'custodian_mappings' => AssetCustodianMapping::query()->where('tenant_id', $user->tenant_id)->orderBy('legacy_key')->get(),
            'discrepancies' => $batch->discrepancies()->orderBy('asset_tag')->limit(200)->get(),
        ];
    }

    /**
     * @param  list<int>  $stagingIds
     */
    public function approve(AssetImportBatch $batch, User $user, array $stagingIds, bool $allNonBlocking = false): int
    {
        $this->assertCanImport($user);
        $this->assertTenant($batch, $user);
        $this->assertBatchMutable($batch);

        $query = AssetImportStaging::query()
            ->where('import_batch_id', $batch->id)
            ->where('blocking', false)
            ->whereNotIn('review_status', ['committed', 'excluded']);
        if (! $allNonBlocking) {
            $query->whereIn('id', $stagingIds);
        }
        $count = $query->update([
            'review_status' => 'approved',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
        ]);

        AuditLog::record('assets.import_approved', [
            'auditable_type' => AssetImportBatch::class,
            'auditable_id' => $batch->id,
            'new_values' => ['approved' => $count],
            'tags' => 'assets',
        ]);

        return $count;
    }

    public function exclude(AssetImportBatch $batch, User $user, int $stagingId, string $reason): AssetImportStaging
    {
        $this->assertCanImport($user);
        $this->assertTenant($batch, $user);
        $this->assertBatchMutable($batch);
        $row = AssetImportStaging::query()->where('import_batch_id', $batch->id)->findOrFail($stagingId);
        $this->assertRowMutable($row);
        $row->review_status = 'excluded';
        $row->proposed_action = 'EXCLUDE';
        $row->admin_notes = $reason;
        $row->reviewed_by = $user->id;
        $row->reviewed_at = now();
        $row->save();

        AuditLog::record('assets.import_excluded', [
            'auditable_type' => AssetImportStaging::class,
            'auditable_id' => $row->id,
            'new_values' => ['reason' => $reason, 'tag' => $row->asset_tag],
            'tags' => 'assets',
        ]);

        return $row;
    }

    public function updateStaging(AssetImportBatch $batch, User $user, int $stagingId, array $data): AssetImportStaging
    {
        $this->assertCanImport($user);
        $this->assertTenant($batch, $user);
        $this->assertBatchMutable($batch);
        $row = AssetImportStaging::query()->where('import_batch_id', $batch->id)->findOrFail($stagingId);
        $this->assertRowMutable($row);
        $allowed = [
            'asset_name', 'make', 'model', 'serial_number', 'legacy_location', 'location_id',
            'custodian_type', 'custodian_user_id', 'custodian_department_id', 'category_code',
            'admin_notes', 'acquisition_date', 'original_cost', 'current_book_value', 'currency',
            'funding_source', 'status',
        ];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $data)) {
                $row->{$key} = $data[$key] === '' ? null : $data[$key];
            }
        }
        $row->save();
        $this->validateRow($row, $user);
        $row->save();

        return $row->fresh();
    }

    public function confirmLocationMapping(AssetImportBatch $batch, User $user, string $legacy, int $locationId): void
    {
        $this->assertCanImport($user);
        $this->assertTenant($batch, $user);
        $this->assertBatchMutable($batch);
        $location = AssetLocation::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereKey($locationId)
            ->firstOrFail();
        AssetLocationMapping::query()->updateOrCreate(
            ['tenant_id' => $user->tenant_id, 'legacy_location' => $legacy],
            [
                'import_batch_id' => $batch->id,
                'location_id' => $location->id,
                'confidence' => 'confirmed',
                'confirmed_by' => $user->id,
                'confirmed_at' => now(),
            ]
        );
        AssetImportStaging::query()
            ->where('import_batch_id', $batch->id)
            ->where('legacy_location', $legacy)
            ->whereNotIn('review_status', ['committed', 'excluded'])
            ->update(['location_id' => $location->id]);
    }

    public function confirmCustodianMapping(AssetImportBatch $batch, User $user, string $legacyKey, array $data): void
    {
        $this->assertCanImport($user);
        $this->assertTenant($batch, $user);
        $this->assertBatchMutable($batch);
        if (! empty($data['user_id'])) {
            User::query()->where('tenant_id', $user->tenant_id)->whereKey($data['user_id'])->firstOrFail();
        }
        if (! empty($data['department_id'])) {
            \App\Models\Department::query()->where('tenant_id', $user->tenant_id)->whereKey($data['department_id'])->firstOrFail();
        }
        if (! empty($data['location_id'])) {
            AssetLocation::query()->where('tenant_id', $user->tenant_id)->whereKey($data['location_id'])->firstOrFail();
        }
        AssetCustodianMapping::query()->updateOrCreate(
            ['tenant_id' => $user->tenant_id, 'legacy_key' => $legacyKey],
            [
                'import_batch_id' => $batch->id,
                'custodian_type' => $data['custodian_type'] ?? 'shared',
                'user_id' => $data['user_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'location_id' => $data['location_id'] ?? null,
                'confidence' => 1,
                'confirmed' => true,
                'confirmed_by' => $user->id,
                'confirmed_at' => now(),
            ]
        );
        $query = AssetImportStaging::query()->where('import_batch_id', $batch->id)
            ->whereNotIn('review_status', ['committed', 'excluded'])
            ->where(function ($q) use ($legacyKey) {
                $q->where('custodian_candidate', $legacyKey)->orWhere('legacy_location', $legacyKey);
            });
        $query->update([
            'custodian_type' => $data['custodian_type'] ?? 'shared',
            'custodian_user_id' => $data['user_id'] ?? null,
            'custodian_department_id' => $data['department_id'] ?? null,
        ]);
    }

    public function equation(AssetImportBatch $batch): array
    {
        $rows = AssetImportStaging::query()->where('import_batch_id', $batch->id)->get();
        $unique = $rows->pluck('asset_tag')->filter()->unique()->count();
        $created = (int) $batch->imported_count;
        $matched = (int) $batch->updated_count + (int) $batch->unchanged_count;
        $excluded = $rows->where('review_status', 'excluded')->count();
        $outstanding = $rows->whereNotIn('review_status', ['excluded'])->filter(function ($r) use ($batch) {
            if ($batch->status === 'committed') {
                return false;
            }

            return $r->review_status !== 'committed';
        })->pluck('asset_tag')->filter()->unique()->count();
        if ($batch->status === 'committed') {
            $outstanding = $rows->where('review_status', '!=', 'excluded')
                ->where('review_status', '!=', 'committed')
                ->pluck('asset_tag')->filter()->unique()->count();
        }
        $explained = $created + $matched + $excluded + $outstanding;
        $balanced = $unique === $explained;

        return [
            'unique_source_tags' => $unique,
            'created' => $created,
            'matched_existing' => $matched,
            'approved_exclusions' => $excluded,
            'outstanding_exceptions' => $outstanding,
            'explained' => $explained,
            'balanced' => $balanced,
            'status' => $balanced && $outstanding === 0 && $batch->status === 'committed' ? 'complete' : ($balanced ? $batch->status : 'incomplete'),
        ];
    }

    /**
     * @param  list<array{record: array<string, mixed>, raw_id: int}>  $parsed
     */
    private function reconcile(AssetImportBatch $batch, User $user, array $parsed): void
    {
        $byTag = [];
        foreach ($parsed as $item) {
            $tag = strtoupper((string) ($item['record']['asset_tag'] ?? ''));
            if ($tag === '') {
                $this->writeUntagged($batch, $user, $item);

                continue;
            }
            $byTag[$tag][] = $item;
        }

        foreach ($byTag as $tag => $items) {
            $merged = $this->mergeTagGroup($batch, $tag, $items);
            $existing = Asset::query()
                ->where('tenant_id', $user->tenant_id)
                ->where(function ($q) use ($tag) {
                    $q->where('tag_number', $tag)->orWhere('asset_code', $tag);
                })
                ->first();

            $proposed = 'CREATE';
            $diff = null;
            if ($existing) {
                $diff = $this->diffExisting($existing, $merged);
                $proposed = $diff === [] ? 'NO_CHANGE' : 'REQUIRES_REVIEW';
                if ($existing->last_verified_at) {
                    $proposed = 'REQUIRES_REVIEW';
                } elseif ($diff !== []) {
                    $proposed = 'UPDATE';
                }
            }

            $parsedDesc = $this->descriptions->parse($merged['legacy_description'] ?? null);
            $make = $merged['make'] ?? $parsedDesc['make'];
            $model = $merged['model'] ?? $parsedDesc['model'];
            $serial = $merged['serial_number'] ?? $parsedDesc['serial'];
            $name = $merged['asset_name'] ?? $parsedDesc['asset_name'] ?? $merged['legacy_description'];

            $locationId = $this->mapLocation($batch, $user, $merged['legacy_location'] ?? null);
            $custodian = $this->suggestCustodian($user, $merged['custodian_candidate'] ?? null, $merged['legacy_location'] ?? null);

            $staging = AssetImportStaging::create([
                'import_batch_id' => $batch->id,
                'tenant_id' => $user->tenant_id,
                'asset_tag' => $tag,
                'asset_name' => $name,
                'description' => $merged['legacy_description'] ?? null,
                'legacy_description' => $merged['legacy_description'] ?? null,
                'legacy_category' => $merged['legacy_category'] ?? null,
                'category_code' => AssetCategoryMapper::toCode($merged['legacy_category'] ?? null),
                'make' => $make,
                'model' => $model,
                'serial_number' => $serial,
                'acquisition_date' => $merged['acquisition_date'] ?? null,
                'original_cost' => $merged['closing_cost'] ?? $merged['opening_cost'] ?? $merged['original_cost'] ?? null,
                'opening_depreciation' => $merged['opening_depreciation'] ?? null,
                'source_depreciation' => $merged['depreciation_ytd'] ?? $merged['accumulated_depreciation'] ?? null,
                'accumulated_depreciation' => $merged['accumulated_depreciation'] ?? null,
                'current_book_value' => $merged['closing_book_value'] ?? $merged['current_book_value'] ?? null,
                'currency' => $merged['currency'] ?? 'NAD',
                'funding_source' => $merged['funding_source'] ?? null,
                'legacy_location' => $merged['legacy_location'] ?? null,
                'location_id' => $locationId,
                'custodian_candidate' => $merged['custodian_candidate'] ?? $custodian['candidate'],
                'custodian_type' => $custodian['type'],
                'custodian_user_id' => null,
                'custodian_department_id' => null,
                'custodian_confidence' => $custodian['confidence'],
                'status' => 'active',
                'proposed_action' => $proposed,
                'review_status' => 'pending',
                'matched_asset_id' => $existing?->id,
                'field_diff' => $diff,
                'source_refs' => $merged['source_refs'],
                'blocking' => ! empty($merged['duplicate_in_source']),
                'blocking_errors' => ! empty($merged['duplicate_in_source']) ? ['DUPLICATE_ASSET_TAG'] : null,
                'data_quality_flags' => array_values(array_unique(array_merge(
                    $parsedDesc['flags'],
                    ! empty($merged['duplicate_in_source']) ? ['ASSET_TAG_CONFLICT'] : []
                ))),
            ]);

            foreach ($items as $item) {
                AssetImportLineage::create([
                    'import_batch_id' => $batch->id,
                    'staging_id' => $staging->id,
                    'asset_tag' => $tag,
                    'raw_id' => $item['raw_id'],
                    'source_kind' => $item['record']['source_kind'] ?? 'unknown',
                ]);
            }
        }

        $batch->unique_tag_count = AssetImportStaging::query()
            ->where('import_batch_id', $batch->id)
            ->whereNotNull('asset_tag')
            ->distinct()
            ->count('asset_tag');
        $batch->save();
    }

    /**
     * @param  list<array{record: array<string, mixed>, raw_id: int}>  $items
     * @return array<string, mixed>
     */
    private function mergeTagGroup(AssetImportBatch $batch, string $tag, array $items): array
    {
        $merged = [
            'asset_tag' => $tag,
            'source_refs' => [],
            'duplicate_in_source' => false,
        ];
        $byKind = [];
        foreach ($items as $item) {
            $kind = $item['record']['source_kind'] ?? 'unknown';
            $byKind[$kind][] = $item['record'];
            $merged['source_refs'][] = [
                'kind' => $kind,
                'file' => $item['record']['source_filename'] ?? null,
                'row' => $item['record']['source_row_number'] ?? null,
                'raw_id' => $item['raw_id'],
            ];
        }
        foreach ($byKind as $kindRecords) {
            if (count($kindRecords) > 1) {
                $merged['duplicate_in_source'] = true;
                break;
            }
        }

        $category = $byKind[CrystalAssetListingParser::KIND_CATEGORY][0] ?? null;
        $location = $byKind[CrystalAssetListingParser::KIND_LOCATION][0] ?? null;
        $staging = $byKind['staging'][0] ?? ($byKind['template'][0] ?? null);

        if ($category) {
            $merged = array_merge($merged, $this->financialsFrom($category));
            $merged['legacy_category'] = $category['legacy_category'] ?? $merged['legacy_category'] ?? null;
            $merged['legacy_description'] = $category['legacy_description'] ?? null;
            $merged['acquisition_date'] = $category['acquisition_date'] ?? null;
        }
        if ($location) {
            $merged['legacy_location'] = $location['legacy_location'] ?? null;
            if (empty($merged['legacy_description'])) {
                $merged['legacy_description'] = $location['legacy_description'] ?? null;
            }
            if (empty($merged['acquisition_date'])) {
                $merged['acquisition_date'] = $location['acquisition_date'] ?? null;
            }
            if (! $category) {
                $merged = array_merge($merged, $this->financialsFrom($location));
            }
            $this->recordDiscrepancies($batch, $tag, $category, $location);
        }
        if ($staging) {
            $merged['asset_name'] = $staging['asset_name'] ?? $merged['asset_name'] ?? null;
            $merged['model'] = $staging['model'] ?? null;
            $merged['serial_number'] = $staging['serial_number'] ?? null;
            $merged['custodian_candidate'] = $staging['custodian_candidate'] ?? null;
            if (empty($merged['legacy_location'])) {
                $merged['legacy_location'] = $staging['legacy_location'] ?? null;
            } elseif (! empty($staging['legacy_location']) && $staging['legacy_location'] !== $merged['legacy_location']) {
                $this->discrepancy($batch, $tag, 'legacy_location', $merged['legacy_location'], $staging['legacy_location'], $merged['legacy_location'], 'prefer_crystal_location');
            }
            if (empty($merged['legacy_description'])) {
                $merged['legacy_description'] = $staging['legacy_description'] ?? null;
            }
            if (empty($merged['legacy_category'])) {
                $merged['legacy_category'] = $staging['legacy_category'] ?? null;
            }
            if (empty($merged['acquisition_date'])) {
                $merged['acquisition_date'] = $staging['acquisition_date'] ?? null;
            }
        }

        return $merged;
    }

    /**
     * @param  array<string, mixed>|null  $category
     * @param  array<string, mixed>|null  $location
     */
    private function recordDiscrepancies(AssetImportBatch $batch, string $tag, ?array $category, ?array $location): void
    {
        if (! $category || ! $location) {
            return;
        }
        foreach (['legacy_description' => 'description', 'acquisition_date' => 'acquisition_date', 'closing_cost' => 'closing_cost', 'closing_book_value' => 'closing_book_value'] as $field => $label) {
            $a = $category[$field] ?? null;
            $b = $location[$field] ?? null;
            if ($this->valuesDiffer($a, $b)) {
                $this->discrepancy($batch, $tag, $label, is_scalar($a) || $a === null ? (string) $a : json_encode($a), is_scalar($b) || $b === null ? (string) $b : json_encode($b), is_scalar($a) || $a === null ? (string) $a : json_encode($a), 'prefer_category_listing');
            }
        }
    }

    private function valuesDiffer(mixed $a, mixed $b): bool
    {
        if ($a === null || $a === '' || $b === null || $b === '') {
            return false;
        }
        if (is_numeric($a) && is_numeric($b)) {
            return round((float) $a, 2) !== round((float) $b, 2);
        }

        return trim((string) $a) !== trim((string) $b);
    }

    private function discrepancy(AssetImportBatch $batch, string $tag, string $field, ?string $a, ?string $b, ?string $chosen, string $rule): void
    {
        AssetImportDiscrepancy::create([
            'import_batch_id' => $batch->id,
            'asset_tag' => $tag,
            'field' => $field,
            'source_a_value' => $a,
            'source_b_value' => $b,
            'chosen_value' => $chosen,
            'rule' => $rule,
            'requires_review' => true,
        ]);
    }

    /**
     * @param  array<string, mixed>  $record
     * @return array<string, mixed>
     */
    private function financialsFrom(array $record): array
    {
        return [
            'opening_cost' => $record['opening_cost'] ?? null,
            'closing_cost' => $record['closing_cost'] ?? null,
            'opening_depreciation' => $record['opening_depreciation'] ?? null,
            'depreciation_ytd' => $record['depreciation_ytd'] ?? null,
            'accumulated_depreciation' => $record['accumulated_depreciation'] ?? null,
            'closing_book_value' => $record['closing_book_value'] ?? null,
        ];
    }

    /**
     * @param  array{record: array<string, mixed>, raw_id: int}  $item
     */
    private function writeUntagged(AssetImportBatch $batch, User $user, array $item): void
    {
        AssetImportStaging::create([
            'import_batch_id' => $batch->id,
            'tenant_id' => $user->tenant_id,
            'asset_name' => $item['record']['asset_name'] ?? null,
            'legacy_description' => $item['record']['legacy_description'] ?? $item['record']['asset_name'] ?? null,
            'proposed_action' => 'REQUIRES_REVIEW',
            'review_status' => 'pending',
            'blocking' => true,
            'blocking_errors' => ['MISSING_ASSET_TAG'],
            'data_quality_flags' => ['MISSING_ASSET_TAG'],
            'data_quality_status' => 'requires_review',
            'source_refs' => [['raw_id' => $item['raw_id'], 'kind' => $item['record']['source_kind'] ?? null]],
        ]);
        AssetImportLineage::create([
            'import_batch_id' => $batch->id,
            'asset_tag' => null,
            'raw_id' => $item['raw_id'],
            'source_kind' => $item['record']['source_kind'] ?? 'unknown',
        ]);
    }

    private function validate(AssetImportBatch $batch, User $user): void
    {
        $rows = AssetImportStaging::query()->where('import_batch_id', $batch->id)->get();
        $serialCounts = $rows->pluck('serial_number')->filter()->countBy();
        $tagCounts = $rows->pluck('asset_tag')->filter()->countBy();
        $warnings = 0;
        $rejected = 0;
        foreach ($rows as $row) {
            $this->validateRow($row, $user, $serialCounts, $tagCounts);
            $row->save();
            $warnings += count($row->warnings ?? []);
            if ($row->blocking) {
                $rejected++;
            }
        }
        $batch->warning_count = $warnings;
        $batch->rejected_row_count = $rejected;
        $batch->unresolved_count = $rows->where('review_status', 'pending')->count();
        $batch->save();
    }

    /**
     * @param  \Illuminate\Support\Collection<string, int>|null  $serialCounts
     * @param  \Illuminate\Support\Collection<string, int>|null  $tagCounts
     */
    public function validateRow(AssetImportStaging $row, User $user, $serialCounts = null, $tagCounts = null): void
    {
        $flags = $row->data_quality_flags ?? [];
        $warnings = [];
        $blocking = [];

        if (empty($row->asset_tag)) {
            $blocking[] = 'MISSING_ASSET_TAG';
            $flags[] = 'MISSING_ASSET_TAG';
        }
        if (
            in_array('DUPLICATE_ASSET_TAG', $row->blocking_errors ?? [], true)
            || in_array('ASSET_TAG_CONFLICT', $flags, true)
            || ($tagCounts && $row->asset_tag && ($tagCounts[$row->asset_tag] ?? 1) > 1)
        ) {
            $blocking[] = 'DUPLICATE_ASSET_TAG';
            $flags[] = 'ASSET_TAG_CONFLICT';
        }
        if (empty($row->serial_number)) {
            $flags[] = 'MISSING_SERIAL';
            $warnings[] = 'Missing serial number';
        } elseif ($serialCounts && ($serialCounts[$row->serial_number] ?? 1) > 1) {
            $flags[] = 'DUPLICATE_SERIAL';
            $warnings[] = 'Duplicate serial number';
        }
        if (empty($row->model)) {
            $flags[] = 'MISSING_MODEL';
            $warnings[] = 'Missing model';
        }
        if (empty($row->legacy_location) && empty($row->location_id)) {
            $flags[] = 'MISSING_LOCATION';
            $warnings[] = 'Missing location';
        } elseif (empty($row->location_id)) {
            $flags[] = 'UNVERIFIED_LOCATION';
            $warnings[] = 'Location not mapped to Nexus location';
        }
        if (empty($row->custodian_user_id) && empty($row->custodian_department_id)) {
            $flags[] = 'UNMAPPED_CUSTODIAN';
            $warnings[] = 'Custodian not confirmed';
        }
        if (empty($row->acquisition_date)) {
            $flags[] = 'MISSING_ACQUISITION_DATE';
            $warnings[] = 'Missing acquisition date';
        }
        if ($row->original_cost === null) {
            $flags[] = 'MISSING_COST';
            $warnings[] = 'Missing cost';
        }

        $flags = array_values(array_unique($flags));
        $row->data_quality_flags = $flags;
        $row->warnings = $warnings;
        $row->blocking_errors = $blocking;
        $row->blocking = $blocking !== [];
        $row->review_status = $row->review_status === 'excluded' ? 'excluded' : ($blocking !== [] ? 'blocked' : $row->review_status);
        $row->data_quality_status = $this->qualityStatus($flags);
    }

    /**
     * @param  list<string>  $flags
     */
    private function qualityStatus(array $flags): string
    {
        if (array_intersect($flags, ['MISSING_ASSET_TAG', 'ASSET_TAG_CONFLICT', 'DUPLICATE_SERIAL'])) {
            return 'requires_review';
        }
        $missing = array_intersect($flags, ['MISSING_SERIAL', 'MISSING_MODEL', 'MISSING_LOCATION', 'UNMAPPED_CUSTODIAN', 'MISSING_COST', 'MISSING_ACQUISITION_DATE']);
        if (count($missing) >= 3) {
            return 'partial';
        }
        if ($missing !== []) {
            return 'good';
        }

        return 'complete';
    }

    private function mapLocation(AssetImportBatch $batch, User $user, ?string $legacy): ?int
    {
        if ($legacy === null || trim($legacy) === '') {
            return null;
        }
        $legacy = trim($legacy);
        $existingMap = AssetLocationMapping::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('legacy_location', $legacy)
            ->first();
        if ($existingMap?->location_id) {
            return $existingMap->location_id;
        }
        $code = Str::slug(mb_substr($legacy, 0, 40), '_');
        $location = AssetLocation::query()->firstOrCreate(
            ['tenant_id' => $user->tenant_id, 'code' => $code !== '' ? $code : 'loc_'.substr(hash('sha256', $legacy), 0, 8)],
            [
                'name' => $legacy,
                'legacy_name' => $legacy,
                'location_type' => $this->guessLocationType($legacy),
                'hierarchy_level' => 'room',
                'is_active' => true,
            ]
        );
        AssetLocationMapping::query()->firstOrCreate(
            ['tenant_id' => $user->tenant_id, 'legacy_location' => $legacy],
            [
                'import_batch_id' => $batch->id,
                'location_id' => $location->id,
                'confidence' => 'suggested',
            ]
        );

        return $location->id;
    }

    private function guessLocationType(string $legacy): string
    {
        $l = strtolower($legacy);
        if (str_contains($l, 'store')) {
            return 'warehouse';
        }
        if (str_contains($l, 'residence') || str_contains($l, 'eros')) {
            return 'residence';
        }
        if (str_contains($l, 'boardroom') || str_contains($l, 'meeting')) {
            return 'meeting_room';
        }
        if (str_contains($l, 'corridor') || str_contains($l, 'library') || str_contains($l, 'head office')) {
            return 'shared';
        }

        return 'office';
    }

    /**
     * @return array{type: string, candidate: ?string, confidence: float}
     */
    private function suggestCustodian(User $user, ?string $candidate, ?string $location): array
    {
        $legacy = $candidate ?: $location;
        $shared = $this->isSharedLocation($location ?? '');
        if ($shared || $legacy === null) {
            return ['type' => 'shared', 'candidate' => $legacy, 'confidence' => 0.2];
        }

        return ['type' => 'user', 'candidate' => $legacy, 'confidence' => 0.4];
    }

    private function isSharedLocation(string $location): bool
    {
        $l = strtolower($location);

        return $location === ''
            || str_contains($l, 'boardroom')
            || str_contains($l, 'store')
            || str_contains($l, 'corridor')
            || str_contains($l, 'library')
            || str_contains($l, 'head office')
            || str_contains($l, 'residence')
            || str_contains($l, 'admin office')
            || str_contains($l, 'general office')
            || str_contains($l, 'server')
            || str_contains($l, 'reception')
            || str_contains($l, 'eros');
    }

    /**
     * @param  array<string, mixed>  $record
     */
    private function storeRaw(AssetImportBatch $batch, array $record): AssetImportRaw
    {
        $raw = $record['raw'] ?? $record;

        return AssetImportRaw::create([
            'import_batch_id' => $batch->id,
            'source_filename' => $record['source_filename'] ?? 'unknown',
            'source_sheet' => $record['source_sheet'] ?? null,
            'source_row_number' => (int) ($record['source_row_number'] ?? 0),
            'source_kind' => $record['source_kind'] ?? 'unknown',
            'raw_json' => $raw,
            'row_fingerprint' => hash('sha256', json_encode($raw)),
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function seedSuggestedMappings(AssetImportBatch $batch, User $user, array $rows): void
    {
        foreach ($rows as $row) {
            $legacy = trim((string) ($row['Legacy Location'] ?? ''));
            if ($legacy === '') {
                continue;
            }
            AssetLocationMapping::query()->firstOrCreate(
                ['tenant_id' => $user->tenant_id, 'legacy_location' => $legacy],
                ['import_batch_id' => $batch->id, 'confidence' => 'suggested']
            );
            $candidate = trim((string) ($row['Suggested Custodian Key'] ?? ''));
            if ($candidate !== '') {
                AssetCustodianMapping::query()->firstOrCreate(
                    ['tenant_id' => $user->tenant_id, 'legacy_key' => $candidate],
                    [
                        'import_batch_id' => $batch->id,
                        'custodian_type' => $this->isSharedLocation($legacy) ? 'shared' : 'user',
                        'confidence' => 0.4,
                    ]
                );
            }
        }
    }

    /**
     * @return array<string, array{old: mixed, imported: mixed}>
     */
    private function diffExisting(Asset $asset, array $merged): array
    {
        $map = [
            'name' => $merged['asset_name'] ?? $merged['legacy_description'] ?? null,
            'serial_number' => $merged['serial_number'] ?? null,
            'purchase_value' => $merged['closing_cost'] ?? $merged['opening_cost'] ?? null,
            'book_value' => $merged['closing_book_value'] ?? null,
        ];
        $diff = [];
        foreach ($map as $field => $incoming) {
            if ($incoming === null || $incoming === '') {
                continue;
            }
            $current = $asset->{$field};
            if ((string) $current !== (string) $incoming) {
                $diff[$field] = ['old' => $current, 'imported' => $incoming];
            }
        }

        return $diff;
    }

    private function nextBatchNumber(int $tenantId): string
    {
        $year = now()->year;
        $count = AssetImportBatch::query()->where('tenant_id', $tenantId)->where('batch_number', 'like', 'AST-IMPORT-'.$year.'-%')->count();

        return sprintf('AST-IMPORT-%d-%03d', $year, $count + 1);
    }

    private function assertCanImport(User $user): void
    {
        if ($user->isSystemAdmin()) {
            return;
        }
        if ($user->hasPermissionTo('assets.import') || $user->hasPermissionTo('assets.admin') || $user->hasPermissionTo('assets.manage')) {
            return;
        }
        abort(403, 'Not authorised to import assets.');
    }

    private function assertTenant(AssetImportBatch $batch, User $user): void
    {
        if ((int) $batch->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertBatchMutable(AssetImportBatch $batch): void
    {
        if ($batch->status === 'committed') {
            throw ValidationException::withMessages(['batch' => 'Committed import batches cannot be modified.']);
        }
    }

    private function assertRowMutable(AssetImportStaging $row): void
    {
        if ($row->review_status === 'committed') {
            throw ValidationException::withMessages(['staging' => 'Committed staging rows cannot be modified.']);
        }
    }
}
