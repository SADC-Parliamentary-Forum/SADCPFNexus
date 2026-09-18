<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetImportBatch;
use App\Models\AssetImportStaging;
use App\Models\AssetVerificationCampaign;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

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

        if ($approveNonBlocking && $this->imports->autoApproveAllowed()) {
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

        set_time_limit(180);
        ignore_user_abort(true);

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

            $this->seedDefaultTemplates($user->tenant_id);
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
        });

        try {
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
        } catch (\Throwable) {
            // Register rows must stay committed even if the audit writer fails.
        }

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
            $this->qr->ensureToken($existing, $user);

            return 'unchanged';
        }

        if ($existing && $row->proposed_action === 'REQUIRES_REVIEW' && $existing->last_verified_at) {
            $this->ensureIdentity($existing, $user);
            $this->qr->ensureToken($existing, $user);

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
            'department' => $this->importedDepartmentName($row),
            'owner_name' => $this->importedOwnerName($row),
            'ownership_type' => is_array($row->source_refs) ? ($row->source_refs['ownership_type'] ?? 'sadc_pf_owned') : 'sadc_pf_owned',
            'home_location_id' => $row->location_id,
            'imei' => is_array($row->source_refs) ? ($row->source_refs['imei'] ?? null) : null,
            'vehicle_registration' => is_array($row->source_refs) ? ($row->source_refs['vehicle_registration'] ?? null) : null,
            'chassis_vin' => is_array($row->source_refs) ? ($row->source_refs['chassis_vin'] ?? $row->source_refs['vin'] ?? null) : null,
            'status' => $row->status ?: 'active',
            'label_status' => 'never_printed',
        ];

        if ($existing) {
            $previousLocationId = $existing->location_id;
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
            if ($existing->location_id && (int) $existing->location_id !== (int) $previousLocationId && ! $existing->last_verified_at) {
                app(\App\Modules\Assets\Services\AssetService::class)->recordLocationBaseline($existing, $user, 'Imported location');
            }
            $this->qr->ensureToken($existing, $user);
            if (! $existing->last_verified_at) {
                $this->applyImportedAssignment($existing, $row, $user);
            }

            return 'updated';
        }

        $asset = new Asset($payload);
        $asset->tenant_id = $user->tenant_id;
        $this->ensureIdentity($asset, $user);
        $asset->save();
        if ($asset->location_id) {
            app(\App\Modules\Assets\Services\AssetService::class)->recordLocationBaseline($asset, $user, 'Imported from Crystal register');
        }
        $this->qr->ensureToken($asset, $user);
        $this->applyImportedAssignment($asset, $row, $user);

        return 'created';
    }

    private function applyImportedAssignment(Asset $asset, AssetImportStaging $row, User $user): void
    {
        if (! $row->custodian_user_id) {
            return;
        }

        $assignee = User::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('id', $row->custodian_user_id)
            ->where('is_active', true)
            ->first();
        if (! $assignee) {
            return;
        }

        $openSame = $asset->assignmentHistories()
            ->whereNull('returned_at')
            ->where('assigned_to', $assignee->id)
            ->exists();
        if ($openSame && (int) $asset->assigned_to === (int) $assignee->id) {
            return;
        }

        try {
            app(AssetService::class)->assign($asset->fresh() ?? $asset, $assignee, $user, [
                'notes' => 'Imported assignment',
                'department' => $this->importedDepartmentName($row),
            ]);
        } catch (ValidationException|HttpException) {
            $fresh = $asset->fresh() ?? $asset;
            $fresh->assigned_to = $assignee->id;
            $department = $this->importedDepartmentName($row);
            if ($department) {
                $fresh->department = $department;
            }
            $fresh->save();
            if (! $fresh->assignmentHistories()->whereNull('returned_at')->where('assigned_to', $assignee->id)->exists()) {
                AssetAssignmentHistory::create([
                    'tenant_id' => $fresh->tenant_id,
                    'asset_id' => $fresh->id,
                    'assigned_to' => $assignee->id,
                    'department' => $department,
                    'assignment_type' => 'custody',
                    'assigned_at' => now(),
                    'assigned_by' => $user->id,
                    'notes' => 'Imported assignment',
                ]);
            }
        }
    }

    private function importedOwnerName(AssetImportStaging $row): string
    {
        $refs = is_array($row->source_refs) ? $row->source_refs : [];
        $owner = trim((string) ($refs['asset_owner'] ?? ''));

        return $owner !== '' ? $owner : 'SADC Parliamentary Forum';
    }

    private function importedDepartmentName(AssetImportStaging $row): ?string
    {
        $refs = is_array($row->source_refs) ? $row->source_refs : [];
        $name = trim((string) ($refs['department'] ?? ''));

        return $name !== '' ? $name : null;
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
        app(AssetLabelService::class)->ensureDefaultTemplates($tenantId);
    }
}
