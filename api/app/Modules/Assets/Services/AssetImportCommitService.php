<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetImportBatch;
use App\Models\AssetImportStaging;
use App\Models\AssetLabelTemplate;
use App\Models\AssetVerificationCampaign;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AssetImportCommitService
{
    public function __construct(
        private readonly AssetQrService $qr,
        private readonly AssetImportService $imports,
    ) {}

    /**
     * @return array{batch: AssetImportBatch, equation: array<string, mixed>}
     */
    public function commit(AssetImportBatch $batch, User $user, bool $approveNonBlocking = false): array
    {
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.import') && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Not authorised to commit asset imports.');
        }
        if ((int) $batch->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($batch->status === 'committed') {
            return ['batch' => $batch, 'equation' => $this->imports->equation($batch)];
        }

        if ($approveNonBlocking) {
            $this->imports->approve($batch, $user, [], true);
        }

        $eligible = AssetImportStaging::query()
            ->where('import_batch_id', $batch->id)
            ->where('blocking', false)
            ->where('review_status', 'approved')
            ->orderBy('id')
            ->get();

        if ($eligible->isEmpty()) {
            throw ValidationException::withMessages(['commit' => 'No approved non-blocking records to commit.']);
        }

        $created = 0;
        $updated = 0;
        $unchanged = 0;

        DB::transaction(function () use ($batch, $user, $eligible, &$created, &$updated, &$unchanged) {
            $batch->status = 'committing';
            $batch->save();

            foreach ($eligible->chunk(50) as $chunk) {
                foreach ($chunk as $row) {
                    $result = $this->commitRow($row, $user, $batch);
                    if ($result === 'created') {
                        $created++;
                    } elseif ($result === 'updated') {
                        $updated++;
                    } else {
                        $unchanged++;
                    }
                    $row->review_status = 'committed';
                    $row->save();
                }
            }

            $this->ensureDefaultTemplates($user->tenant_id);
            $this->openVerificationCampaign($user, $batch);

            $batch->imported_count = (int) $batch->imported_count + $created;
            $batch->updated_count = (int) $batch->updated_count + $updated;
            $batch->unchanged_count = (int) $batch->unchanged_count + $unchanged;
            $batch->excluded_count = AssetImportStaging::query()->where('import_batch_id', $batch->id)->where('review_status', 'excluded')->count();
            $batch->unresolved_count = AssetImportStaging::query()->where('import_batch_id', $batch->id)->whereNotIn('review_status', ['committed', 'excluded'])->count();
            $batch->committed_at = now();
            $batch->completed_at = now();
            $equation = $this->imports->equation($batch);
            $batch->summary = $equation;
            $batch->status = $equation['balanced'] && $equation['outstanding_exceptions'] === 0 ? 'committed' : 'incomplete';
            $batch->save();

            AuditLog::record('assets.import_committed', [
                'auditable_type' => AssetImportBatch::class,
                'auditable_id' => $batch->id,
                'new_values' => [
                    'created' => $created,
                    'updated' => $updated,
                    'unchanged' => $unchanged,
                    'status' => $batch->status,
                ],
                'tags' => 'assets',
            ]);
        });

        $fresh = $batch->fresh();

        return ['batch' => $fresh, 'equation' => $this->imports->equation($fresh)];
    }

    private function commitRow(AssetImportStaging $row, User $user, AssetImportBatch $batch): string
    {
        $existing = $row->matched_asset_id
            ? Asset::query()->where('tenant_id', $user->tenant_id)->find($row->matched_asset_id)
            : Asset::query()->where('tenant_id', $user->tenant_id)->where(function ($q) use ($row) {
                $q->where('tag_number', $row->asset_tag)->orWhere('asset_code', $row->asset_tag);
            })->first();

        if ($existing && $row->proposed_action === 'NO_CHANGE') {
            $this->ensureIdentity($existing, $user);
            $this->qr->ensure($existing, $user);

            return 'unchanged';
        }

        if ($existing && $row->proposed_action === 'REQUIRES_REVIEW' && $existing->last_verified_at) {
            $this->ensureIdentity($existing, $user);
            $this->qr->ensure($existing, $user);

            return 'unchanged';
        }

        $payload = [
            'name' => $row->asset_name ?: ($row->legacy_description ?: $row->asset_tag),
            'category' => $row->category_code ?: 'equipment',
            'manufacturer' => $row->make,
            'model' => $row->model,
            'serial_number' => $row->serial_number,
            'tag_number' => $row->asset_tag,
            'asset_code' => $row->asset_tag,
            'purchase_date' => $row->acquisition_date,
            'purchase_value' => $row->original_cost,
            'opening_depreciation' => $row->opening_depreciation,
            'source_depreciation' => $row->source_depreciation,
            'accumulated_depreciation' => $row->accumulated_depreciation,
            'book_value' => $row->current_book_value,
            'source_book_value' => $row->current_book_value,
            'currency' => $row->currency ?: 'NAD',
            'funding_source' => $row->funding_source,
            'location_id' => $row->location_id,
            'legacy_description' => $row->legacy_description,
            'legacy_location' => $row->legacy_location,
            'legacy_category' => $row->legacy_category,
            'source_import_batch_id' => $batch->id,
            'verification_status' => 'unverified',
            'data_quality_status' => $row->data_quality_status,
            'data_quality_flags' => $row->data_quality_flags,
            'custodian_type' => $row->custodian_type,
            'custodian_department_id' => $row->custodian_department_id,
            'assigned_to' => $row->custodian_user_id,
            'status' => $row->status ?: 'active',
            'label_status' => 'never_printed',
        ];

        if ($existing) {
            $old = $existing->only(array_keys($payload));
            foreach ($payload as $key => $value) {
                if ($key === 'assigned_to' && $existing->last_verified_at) {
                    continue;
                }
                if ($key === 'location_id' && $existing->last_verified_at) {
                    continue;
                }
                $existing->{$key} = $value;
            }
            $this->ensureIdentity($existing, $user);
            $existing->save();
            $this->qr->ensure($existing, $user);
            AuditLog::record('assets.import_updated', [
                'auditable_type' => Asset::class,
                'auditable_id' => $existing->id,
                'old_values' => $old,
                'new_values' => $payload,
                'tags' => 'assets',
            ]);

            return 'updated';
        }

        $asset = new Asset($payload);
        $asset->tenant_id = $user->tenant_id;
        $this->ensureIdentity($asset, $user);
        $asset->save();
        $this->qr->ensure($asset, $user);
        AuditLog::record('assets.import_created', [
            'auditable_type' => Asset::class,
            'auditable_id' => $asset->id,
            'new_values' => ['asset_tag' => $asset->tag_number, 'uuid' => $asset->uuid],
            'tags' => 'assets',
        ]);

        return 'created';
    }

    private function ensureIdentity(Asset $asset, User $user): void
    {
        if (! $asset->uuid) {
            $asset->uuid = (string) Str::uuid();
        }
        if (! $asset->tag_number && $asset->asset_code) {
            $asset->tag_number = $asset->asset_code;
        }
    }

    private function openVerificationCampaign(User $user, AssetImportBatch $batch): void
    {
        $name = '2026 SADC PF COMPLETE ASSET VERIFICATION';
        $exists = AssetVerificationCampaign::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('name', $name)
            ->where('status', 'open')
            ->first();
        if ($exists) {
            return;
        }
        AssetVerificationCampaign::create([
            'tenant_id' => $user->tenant_id,
            'name' => $name,
            'status' => 'open',
            'starts_on' => now()->toDateString(),
            'created_by' => $user->id,
        ]);
    }

    public function seedDefaultTemplates(int $tenantId): void
    {
        $this->ensureDefaultTemplates($tenantId);
    }

    private function ensureDefaultTemplates(int $tenantId): void
    {
        AssetLabelTemplate::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'code' => 'avery_l7161_permanent'],
            [
                'name' => 'Avery L7161 permanent (63.5 × 46.6 mm, 18-up)',
                'kind' => 'permanent',
                'page_size' => 'A4',
                'page_width_mm' => 210,
                'page_height_mm' => 297,
                'margin_top_mm' => 8.7,
                'margin_left_mm' => 4.7,
                'label_width_mm' => 63.5,
                'label_height_mm' => 46.6,
                'h_gap_mm' => 2.5,
                'v_gap_mm' => 0,
                'rows' => 6,
                'columns' => 3,
                'font_pt' => 8,
                'qr_mm' => 22,
                'is_default' => true,
                'is_active' => true,
            ]
        );
        AssetLabelTemplate::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'code' => 'avery_l7161_custody'],
            [
                'name' => 'Avery L7161 custody (63.5 × 46.6 mm, 18-up)',
                'kind' => 'custody',
                'page_size' => 'A4',
                'page_width_mm' => 210,
                'page_height_mm' => 297,
                'margin_top_mm' => 8.7,
                'margin_left_mm' => 4.7,
                'label_width_mm' => 63.5,
                'label_height_mm' => 46.6,
                'h_gap_mm' => 2.5,
                'v_gap_mm' => 0,
                'rows' => 6,
                'columns' => 3,
                'font_pt' => 8,
                'qr_mm' => 22,
                'is_default' => false,
                'is_active' => true,
            ]
        );
        AssetLabelTemplate::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'code' => 'thermal_70x40'],
            [
                'name' => 'Thermal 70 × 40 mm',
                'kind' => 'permanent',
                'page_size' => 'custom',
                'page_width_mm' => 70,
                'page_height_mm' => 40,
                'margin_top_mm' => 2,
                'margin_left_mm' => 2,
                'label_width_mm' => 70,
                'label_height_mm' => 40,
                'h_gap_mm' => 0,
                'v_gap_mm' => 0,
                'rows' => 1,
                'columns' => 1,
                'font_pt' => 8,
                'qr_mm' => 18,
                'is_default' => false,
                'is_active' => true,
            ]
        );
    }
}
