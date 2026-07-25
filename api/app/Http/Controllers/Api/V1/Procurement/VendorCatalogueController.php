<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Vendor;
use App\Models\VendorCatalogueItem;
use App\Models\VendorCatalogueItemVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VendorCatalogueController extends Controller
{
    private function gate(Request $request): void
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin'])) {
            abort(403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->gate($request);
        $query = VendorCatalogueItem::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('vendor:id,name')
            ->orderBy('item_name');

        if ($request->filled('vendor_id')) {
            $query->where('vendor_id', (int) $request->vendor_id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gate($request);
        $data = $request->validate([
            'vendor_id'  => ['required', 'integer', 'exists:vendors,id'],
            'item_name'  => ['required', 'string', 'max:255'],
            'sku'        => ['nullable', 'string', 'max:80'],
            'unit'       => ['nullable', 'string', 'max:40'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'currency'   => ['nullable', 'string', 'max:10'],
            'notes'      => ['nullable', 'string'],
        ]);

        $vendor = Vendor::where('tenant_id', $request->user()->tenant_id)->findOrFail($data['vendor_id']);

        $item = DB::transaction(function () use ($data, $request, $vendor) {
            $item = VendorCatalogueItem::create([
                'tenant_id'  => $request->user()->tenant_id,
                'vendor_id'  => $vendor->id,
                'item_name'  => $data['item_name'],
                'sku'        => $data['sku'] ?? null,
                'unit'       => $data['unit'] ?? 'unit',
                'unit_price' => $data['unit_price'],
                'currency'   => $data['currency'] ?? 'NAD',
                'notes'      => $data['notes'] ?? null,
                'updated_by' => $request->user()->id,
                'is_active'  => true,
            ]);

            VendorCatalogueItemVersion::create([
                'vendor_catalogue_item_id' => $item->id,
                'version'                  => 1,
                'unit_price'               => $item->unit_price,
                'currency'                 => $item->currency,
                'unit'                     => $item->unit,
                'change_reason'            => 'Initial catalogue entry',
                'changed_by'               => $request->user()->id,
                'changed_at'               => now(),
            ]);

            return $item;
        });

        AuditLog::record('procurement.catalogue_item_created', [
            'auditable_type' => VendorCatalogueItem::class,
            'auditable_id'   => $item->id,
            'tags'           => ['procurement', 'catalogue'],
        ]);

        return response()->json(['message' => 'Catalogue item created.', 'data' => $item->load('vendor:id,name')], 201);
    }

    public function show(Request $request, VendorCatalogueItem $catalogue): JsonResponse
    {
        $this->gate($request);
        if ((int) $catalogue->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json(['data' => $catalogue->load('vendor:id,name')]);
    }

    public function update(Request $request, VendorCatalogueItem $catalogue): JsonResponse
    {
        $this->gate($request);
        if ((int) $catalogue->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'item_name'     => ['sometimes', 'string', 'max:255'],
            'sku'           => ['nullable', 'string', 'max:80'],
            'unit'          => ['nullable', 'string', 'max:40'],
            'unit_price'    => ['sometimes', 'numeric', 'min:0'],
            'currency'      => ['nullable', 'string', 'max:10'],
            'is_active'     => ['nullable', 'boolean'],
            'notes'         => ['nullable', 'string'],
            'change_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $catalogue = DB::transaction(function () use ($catalogue, $data, $request) {
            $priceChanging = array_key_exists('unit_price', $data)
                && (float) $data['unit_price'] !== (float) $catalogue->unit_price;

            $catalogue->fill(collect($data)->except('change_reason')->all());
            $catalogue->updated_by = $request->user()->id;
            $catalogue->save();

            if ($priceChanging || array_key_exists('unit', $data) || array_key_exists('currency', $data)) {
                $nextVersion = ((int) $catalogue->versions()->max('version')) + 1;
                VendorCatalogueItemVersion::create([
                    'vendor_catalogue_item_id' => $catalogue->id,
                    'version'                  => $nextVersion,
                    'unit_price'               => $catalogue->unit_price,
                    'currency'                 => $catalogue->currency,
                    'unit'                     => $catalogue->unit,
                    'change_reason'            => $data['change_reason'] ?? 'Catalogue update',
                    'changed_by'               => $request->user()->id,
                    'changed_at'               => now(),
                ]);
            }

            return $catalogue;
        });

        return response()->json(['message' => 'Catalogue item updated.', 'data' => $catalogue->fresh('vendor:id,name')]);
    }

    public function history(Request $request, VendorCatalogueItem $catalogue): JsonResponse
    {
        $this->gate($request);
        if ((int) $catalogue->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json(['data' => $catalogue->versions()->with('changedBy:id,name')->get()]);
    }

    public function destroy(Request $request, VendorCatalogueItem $catalogue): JsonResponse
    {
        $this->gate($request);
        if ((int) $catalogue->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $catalogue->delete();

        return response()->json(['message' => 'Catalogue item deleted.']);
    }
}
