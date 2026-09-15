<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetAcquisitionBatch;
use App\Models\AssetAcquisitionBatchItem;
use App\Models\AssetCategory;
use App\Models\AssetLocation;
use App\Models\AssetSubcategory;
use App\Models\AuditLog;
use App\Models\GoodsReceiptNote;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AssetAcquisitionBatchService
{
    public function __construct(
        private readonly AssetNumberingService $numbering,
        private readonly AssetQrService $qr,
        private readonly AssetLabelService $labels,
        private readonly AssetTimelineService $timeline,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $actor, array $data): AssetAcquisitionBatch
    {
        $this->assertManage($actor);

        $qty = max(1, (int) ($data['qty'] ?? 1));
        if ($qty > 500) {
            throw ValidationException::withMessages(['qty' => 'Quantity cannot exceed 500.']);
        }

        $locationId = $data['home_location_id'] ?? $this->defaultStoreId((int) $actor->tenant_id);

        $batch = AssetAcquisitionBatch::create([
            'tenant_id' => $actor->tenant_id,
            'reference' => $this->nextReference((int) $actor->tenant_id, 'BATCH'),
            'description' => $data['description'] ?? null,
            'qty' => $qty,
            'unit_cost' => $data['unit_cost'] ?? null,
            'currency' => $data['currency'] ?? 'NAD',
            'supplier_id' => $data['supplier_id'] ?? null,
            'supplier_name' => $data['supplier_name'] ?? null,
            'purchase_order_id' => $data['purchase_order_id'] ?? null,
            'goods_receipt_note_id' => $data['goods_receipt_note_id'] ?? null,
            'invoice_number' => $data['invoice_number'] ?? null,
            'funding_source_id' => $data['funding_source_id'] ?? null,
            'funding_source' => $data['funding_source'] ?? null,
            'received_date' => $data['received_date'] ?? now()->toDateString(),
            'category' => $data['category'] ?? null,
            'subcategory_code' => $data['subcategory_code'] ?? null,
            'home_location_id' => $locationId,
            'status' => 'received',
            'created_by' => $actor->id,
        ]);

        AuditLog::record('assets.batch_created', [
            'auditable_type' => AssetAcquisitionBatch::class,
            'auditable_id' => $batch->id,
            'new_values' => ['reference' => $batch->reference, 'qty' => $qty],
            'tags' => 'assets',
        ]);

        return $batch->fresh() ?? $batch;
    }

    public function createAssets(AssetAcquisitionBatch $batch, User $actor, array $data = []): AssetAcquisitionBatch
    {
        $this->assertManage($actor);
        $this->assertTenant($batch, $actor);

        if (in_array($batch->status, ['assets_created', 'closed'], true) && $batch->items()->whereNotNull('asset_id')->exists()) {
            throw ValidationException::withMessages(['status' => 'This lot already has created assets.']);
        }

        $category = (string) ($data['category'] ?? $batch->category ?? '');
        if ($category === '') {
            throw ValidationException::withMessages(['category' => 'Category is required to number assets.']);
        }
        $allowed = AssetCategory::forTenant($actor->tenant_id)->pluck('code')->all();
        if ($allowed !== [] && ! in_array($category, $allowed, true)) {
            throw ValidationException::withMessages(['category' => 'Invalid asset category for this tenant.']);
        }

        $subCode = $data['subcategory_code'] ?? $batch->subcategory_code;
        $subcategory = null;
        if ($subCode) {
            $categoryRow = AssetCategory::forTenant($actor->tenant_id)->where('code', $category)->first();
            if ($categoryRow) {
                $subcategory = AssetSubcategory::query()
                    ->where('asset_category_id', $categoryRow->id)
                    ->whereRaw('upper(code) = ?', [strtoupper((string) $subCode)])
                    ->first();
            }
        }

        $qty = (int) ($data['qty'] ?? $batch->qty);
        $name = (string) ($data['name'] ?? $batch->description ?? $category.' asset');
        $locationId = $data['home_location_id'] ?? $batch->home_location_id ?? $this->defaultStoreId((int) $actor->tenant_id);

        return DB::transaction(function () use ($batch, $actor, $qty, $category, $subCode, $subcategory, $name, $locationId, $data) {
            for ($i = 1; $i <= $qty; $i++) {
                $tag = $this->numbering->issue((int) $actor->tenant_id, $category, $subcategory?->code ?? $subCode);
                $suffix = $qty > 1 ? ' #'.$i : '';
                $asset = Asset::create([
                    'tenant_id' => $actor->tenant_id,
                    'asset_code' => $tag,
                    'tag_number' => $tag,
                    'name' => ($data['name'] ?? $name).$suffix,
                    'category' => $category,
                    'subcategory_id' => $subcategory?->id,
                    'status' => 'available',
                    'condition' => $data['condition'] ?? 'good',
                    'assigned_to' => null,
                    'custodian_type' => 'location',
                    'location_id' => $locationId,
                    'home_location_id' => $locationId,
                    'ownership_type' => $data['ownership_type'] ?? 'sadc_pf_owned',
                    'owner_name' => 'SADC Parliamentary Forum',
                    'purchase_order_id' => $batch->purchase_order_id,
                    'goods_receipt_note_id' => $batch->goods_receipt_note_id,
                    'invoice_number' => $batch->invoice_number,
                    'funding_source_id' => $batch->funding_source_id,
                    'funding_source' => $batch->funding_source,
                    'supplier_name' => $batch->supplier_name,
                    'purchase_value' => $batch->unit_cost,
                    'currency' => $batch->currency,
                    'received_date' => $batch->received_date,
                    'purchase_date' => $batch->received_date,
                    'acquisition_batch_id' => $batch->id,
                    'serial_number' => $data['serial_numbers'][$i - 1] ?? null,
                ]);
                $this->qr->ensure($asset, $actor);
                AssetAcquisitionBatchItem::create([
                    'tenant_id' => $actor->tenant_id,
                    'batch_id' => $batch->id,
                    'asset_id' => $asset->id,
                    'name' => $asset->name,
                    'serial_number' => $asset->serial_number,
                ]);
                $this->timeline->record($asset, 'ASSETS_CREATED', 'Created from acquisition lot '.$batch->reference, $actor, [
                    'batch_id' => $batch->id,
                    'reference' => $batch->reference,
                ]);
            }

            $batch->status = 'assets_created';
            $batch->category = $category;
            $batch->subcategory_code = $subCode;
            $batch->qty = $qty;
            $batch->save();

            AuditLog::record('assets.batch_assets_created', [
                'auditable_type' => AssetAcquisitionBatch::class,
                'auditable_id' => $batch->id,
                'new_values' => ['qty' => $qty, 'category' => $category],
                'tags' => 'assets',
            ]);

            return $batch->fresh(['items.asset']) ?? $batch;
        });
    }

    public function printLabels(AssetAcquisitionBatch $batch, User $actor, int $templateId): array
    {
        $this->assertManage($actor);
        $this->assertTenant($batch, $actor);
        $ids = $batch->items()->whereNotNull('asset_id')->pluck('asset_id')->all();
        if ($ids === []) {
            throw ValidationException::withMessages(['batch' => 'Create assets before printing labels.']);
        }
        $result = $this->labels->print($actor, $ids, $templateId);
        foreach ($batch->assets as $asset) {
            $this->timeline->record($asset, 'LABEL_PRINTED', 'Label printed from lot '.$batch->reference, $actor, [
                'batch_id' => $batch->id,
            ]);
        }

        return $result;
    }

    public function attachGrn(AssetAcquisitionBatch $batch, GoodsReceiptNote $grn, User $actor): AssetAcquisitionBatch
    {
        $this->assertManage($actor);
        $this->assertTenant($batch, $actor);
        if ((int) $grn->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
        $batch->goods_receipt_note_id = $grn->id;
        $batch->purchase_order_id = $batch->purchase_order_id ?: $grn->purchase_order_id;
        $batch->status = $batch->status === 'draft' ? 'received' : $batch->status;
        $batch->save();

        $pending = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('goods_receipt_note_id', $grn->id)
            ->whereNull('acquisition_batch_id')
            ->get();
        foreach ($pending as $asset) {
            $asset->acquisition_batch_id = $batch->id;
            $asset->save();
            AssetAcquisitionBatchItem::firstOrCreate(
                ['batch_id' => $batch->id, 'asset_id' => $asset->id],
                ['tenant_id' => $actor->tenant_id, 'name' => $asset->name, 'serial_number' => $asset->serial_number]
            );
        }

        return $batch->fresh(['items']) ?? $batch;
    }

    /**
     * @return array<string, mixed>
     */
    public function progress(AssetAcquisitionBatch $batch): array
    {
        $assets = Asset::query()->where('acquisition_batch_id', $batch->id)->get();
        $created = $assets->count();
        $labelled = $assets->whereNotIn('label_status', [null, 'never_printed'])->count();
        $assigned = $assets->whereNotNull('assigned_to')->count();
        $available = $assets->where('status', 'available')->whereNull('assigned_to')->whereNull('reserved_handover_id')->count();

        return [
            'id' => $batch->id,
            'reference' => $batch->reference,
            'status' => $batch->status,
            'qty' => $batch->qty,
            'received' => $batch->qty,
            'created' => $created,
            'labels_printed' => $labelled,
            'assigned' => $assigned,
            'still_available' => $available,
            'home_location_id' => $batch->home_location_id,
        ];
    }

    public function present(AssetAcquisitionBatch $batch): array
    {
        $batch->loadMissing(['items.asset', 'homeLocation', 'createdBy:id,name']);

        return array_merge($batch->toArray(), ['progress' => $this->progress($batch)]);
    }

    public function pdfResponse(array $result): Response
    {
        return $this->labels->pdfResponse($result);
    }

    public function nextReference(int $tenantId, string $prefix): string
    {
        $year = now()->year;
        $like = $prefix.'-'.$year.'-%';
        $count = match ($prefix) {
            'HO' => \App\Models\AssetHandover::query()->where('tenant_id', $tenantId)->where('reference', 'like', $like)->count(),
            default => AssetAcquisitionBatch::query()->where('tenant_id', $tenantId)->where('reference', 'like', $like)->count(),
        };

        return sprintf('%s-%d-%05d', $prefix, $year, $count + 1);
    }

    public function defaultStoreId(int $tenantId): ?int
    {
        $store = AssetLocation::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('location_type', 'store')
                    ->orWhereRaw('lower(name) like ?', ['%main store%'])
                    ->orWhereRaw('lower(name) like ?', ['%asset store%']);
            })
            ->orderByRaw("case when location_type = 'store' then 0 else 1 end")
            ->first();
        if ($store) {
            return $store->id;
        }

        $created = AssetLocation::create([
            'tenant_id' => $tenantId,
            'code' => 'STORE',
            'name' => 'Main Store',
            'location_type' => 'store',
            'is_active' => true,
        ]);

        return $created->id;
    }

    private function assertManage(User $actor): void
    {
        if (! AssetAccess::canManageHandover($actor) && ! AssetAccess::canManage($actor)) {
            abort(403, 'Not authorised to manage acquisition lots.');
        }
    }

    private function assertTenant(AssetAcquisitionBatch $batch, User $actor): void
    {
        if ((int) $batch->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
