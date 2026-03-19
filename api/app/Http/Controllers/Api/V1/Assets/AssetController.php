<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetCategory;
use Carbon\Carbon;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\SvgWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    /**
     * List assets. Optional ?assigned_to=me for current user's assigned assets only.
     * Response includes computed age_years, age_display, current_value via model appends.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Asset::where('tenant_id', $user->tenant_id);

        if ($request->input('assigned_to') === 'me') {
            $query->where('assigned_to', $user->id);
        }

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $assets = $query->orderBy('name')->paginate($perPage);

        return response()->json($assets);
    }

    /**
     * Create an asset. Only system admin or users with assets.admin / assets.manage may add.
     * Accepts invoice and financial fields; computes and stores current (depreciated) value when possible.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Only system administrators or asset managers can add assets.');
        }

        $allowedCategories = AssetCategory::forTenant($user->tenant_id)->pluck('code')->values()->all();
        if (empty($allowedCategories)) {
            abort(422, 'No asset categories defined. Create asset categories first.');
        }
        $validated = $request->validate([
            'asset_code'          => ['required', 'string', 'max:64', 'unique:assets,asset_code'],
            'name'                => ['required', 'string', 'max:255'],
            'category'            => ['required', 'string', 'max:32', Rule::in($allowedCategories)],
            'status'              => ['nullable', 'string', 'in:active,service_due,loan_out,retired'],
            'assigned_to'         => ['nullable', 'integer', 'exists:users,id'],
            'issued_at'           => ['nullable', 'date'],
            'value'               => ['nullable', 'numeric', 'min:0'],
            'notes'               => ['nullable', 'string', 'max:2000'],
            'invoice_number'      => ['nullable', 'string', 'max:64'],
            'invoice_path'        => ['nullable', 'string', 'max:500'],
            'purchase_date'       => ['nullable', 'date'],
            'purchase_value'      => ['nullable', 'numeric', 'min:0'],
            'useful_life_years'   => ['nullable', 'integer', 'min:1', 'max:100'],
            'salvage_value'       => ['nullable', 'numeric', 'min:0'],
            'depreciation_method' => ['nullable', 'string', 'in:straight_line,declining_balance'],
        ]);

        $purchaseValue = isset($validated['purchase_value']) ? (float) $validated['purchase_value'] : null;
        $usefulLife = isset($validated['useful_life_years']) ? (int) $validated['useful_life_years'] : null;
        $salvage = isset($validated['salvage_value']) ? (float) $validated['salvage_value'] : 0.0;
        $refDate = null;
        if (! empty($validated['purchase_date'])) {
            $refDate = Carbon::parse($validated['purchase_date']);
        } elseif (! empty($validated['issued_at'])) {
            $refDate = Carbon::parse($validated['issued_at']);
        }
        $computedValue = Asset::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $refDate);
        $storedValue = $computedValue ?? (isset($validated['value']) ? (float) $validated['value'] : null);

        $asset = Asset::create([
            'tenant_id'            => $user->tenant_id,
            'asset_code'           => $validated['asset_code'],
            'name'                 => $validated['name'],
            'category'             => $validated['category'],
            'status'               => $validated['status'] ?? 'active',
            'assigned_to'          => $validated['assigned_to'] ?? null,
            'issued_at'            => $validated['issued_at'] ?? null,
            'value'                => $storedValue,
            'notes'                => $validated['notes'] ?? null,
            'invoice_number'       => $validated['invoice_number'] ?? null,
            'invoice_path'         => $validated['invoice_path'] ?? null,
            'purchase_date'        => $validated['purchase_date'] ?? null,
            'purchase_value'       => $purchaseValue,
            'useful_life_years'    => $usefulLife,
            'salvage_value'        => isset($validated['salvage_value']) ? (float) $validated['salvage_value'] : null,
            'depreciation_method'  => $validated['depreciation_method'] ?? 'straight_line',
        ]);

        $this->generateAndSaveQr($asset);

        return response()->json($asset->fresh(), 201);
    }

    /**
     * Show a single asset. Same visibility as index (tenant).
     */
    public function show(Request $request, Asset $asset): JsonResponse
    {
        $user = $request->user();
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        return response()->json($asset);
    }

    /**
     * Update an asset. Same auth as store. If asset_code changes, QR is regenerated.
     */
    public function update(Request $request, Asset $asset): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Only system administrators or asset managers can edit assets.');
        }
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $allowedCategories = AssetCategory::forTenant($user->tenant_id)->pluck('code')->values()->all();
        if (empty($allowedCategories)) {
            abort(422, 'No asset categories defined. Create asset categories first.');
        }
        $validated = $request->validate([
            'asset_code'          => ['required', 'string', 'max:64', Rule::unique('assets', 'asset_code')->ignore($asset->id)],
            'name'                => ['required', 'string', 'max:255'],
            'category'            => ['required', 'string', 'max:32', Rule::in($allowedCategories)],
            'status'              => ['nullable', 'string', 'in:active,service_due,loan_out,retired'],
            'assigned_to'         => ['nullable', 'integer', 'exists:users,id'],
            'issued_at'           => ['nullable', 'date'],
            'value'               => ['nullable', 'numeric', 'min:0'],
            'notes'               => ['nullable', 'string', 'max:2000'],
            'invoice_number'      => ['nullable', 'string', 'max:64'],
            'invoice_path'        => ['nullable', 'string', 'max:500'],
            'purchase_date'       => ['nullable', 'date'],
            'purchase_value'      => ['nullable', 'numeric', 'min:0'],
            'useful_life_years'   => ['nullable', 'integer', 'min:1', 'max:100'],
            'salvage_value'       => ['nullable', 'numeric', 'min:0'],
            'depreciation_method' => ['nullable', 'string', 'in:straight_line,declining_balance'],
        ]);

        $purchaseValue = isset($validated['purchase_value']) ? (float) $validated['purchase_value'] : null;
        $usefulLife = isset($validated['useful_life_years']) ? (int) $validated['useful_life_years'] : null;
        $salvage = isset($validated['salvage_value']) ? (float) $validated['salvage_value'] : 0.0;
        $refDate = null;
        if (! empty($validated['purchase_date'])) {
            $refDate = Carbon::parse($validated['purchase_date']);
        } elseif (! empty($validated['issued_at'])) {
            $refDate = Carbon::parse($validated['issued_at']);
        }
        $computedValue = Asset::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $refDate);
        $storedValue = $computedValue ?? (isset($validated['value']) ? (float) $validated['value'] : null);

        $oldAssetCode = $asset->asset_code;

        $asset->asset_code           = $validated['asset_code'];
        $asset->name                 = $validated['name'];
        $asset->category             = $validated['category'];
        $asset->status               = $validated['status'] ?? 'active';
        $asset->assigned_to          = $validated['assigned_to'] ?? null;
        $asset->issued_at            = $validated['issued_at'] ?? null;
        $asset->value                = $storedValue;
        $asset->notes                = $validated['notes'] ?? null;
        $asset->invoice_number       = $validated['invoice_number'] ?? null;
        $asset->invoice_path         = $validated['invoice_path'] ?? null;
        $asset->purchase_date        = $validated['purchase_date'] ?? null;
        $asset->purchase_value       = $purchaseValue;
        $asset->useful_life_years    = $usefulLife;
        $asset->salvage_value        = isset($validated['salvage_value']) ? (float) $validated['salvage_value'] : null;
        $asset->depreciation_method  = $validated['depreciation_method'] ?? 'straight_line';
        $asset->save();

        if ($asset->asset_code !== $oldAssetCode) {
            if ($asset->qr_path && Storage::disk('local')->exists($asset->qr_path)) {
                Storage::disk('local')->delete($asset->qr_path);
            }
            $this->generateAndSaveQr($asset);
        }

        return response()->json($asset->fresh());
    }

    /**
     * Serve QR code image for an asset. Same visibility as index (tenant).
     */
    public function qr(Request $request, Asset $asset): Response|JsonResponse
    {
        $user = $request->user();
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        // Generate QR on-the-fly if not yet stored
        if (! $asset->qr_path || ! Storage::disk('local')->exists($asset->qr_path)) {
            $this->generateAndSaveQr($asset);
            $asset->refresh();
        }
        if (! $asset->qr_path || ! Storage::disk('local')->exists($asset->qr_path)) {
            abort(404, 'QR code could not be generated.');
        }
        $contents = Storage::disk('local')->get($asset->qr_path);
        $isPng = str_ends_with($asset->qr_path, '.png');
        return response($contents, 200, [
            'Content-Type'        => $isPng ? 'image/png' : 'image/svg+xml',
            'Content-Disposition' => 'inline; filename="asset-' . $asset->asset_code . '-qr.' . ($isPng ? 'png' : 'svg') . '"',
        ]);
    }

    /**
     * Generate QR code (asset_code) and save to storage; update asset.qr_path.
     */
    private function generateAndSaveQr(Asset $asset): void
    {
        $data = $asset->asset_code;
        try {
            $result = Builder::create()
                ->writer(new SvgWriter())
                ->data($data)
                ->size(200)
                ->margin(10)
                ->build();
            $svg = $result->getString();
        } catch (\Throwable $e) {
            return;
        }
        $dir = 'qr/assets/' . $asset->tenant_id;
        $filename = $asset->id . '.svg';
        $path = $dir . '/' . $filename;
        Storage::disk('local')->put($path, $svg);
        $asset->qr_path = $path;
        $asset->save();
    }

    /**
     * Upload invoice document for an asset (PDF or image). Same auth as store.
     */
    public function uploadInvoice(Request $request, Asset $asset): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Only system administrators or asset managers can upload invoices.');
        }
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $request->validate([
            'invoice' => ['required', 'file', 'mimes:pdf,jpeg,png,jpg,webp', 'max:10240'],
        ]);

        $file = $request->file('invoice');
        $ext = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin';
        $safeExt = in_array(strtolower($ext), ['pdf', 'jpeg', 'jpg', 'png', 'webp'], true) ? strtolower($ext) : 'bin';
        $dir = 'invoices/assets/' . $asset->tenant_id;
        $filename = $asset->id . '_' . Str::random(8) . '.' . $safeExt;
        $path = $file->storeAs($dir, $filename, ['disk' => 'local']);

        if ($asset->invoice_path && Storage::disk('local')->exists($asset->invoice_path)) {
            Storage::disk('local')->delete($asset->invoice_path);
        }

        $asset->invoice_path = $path;
        $asset->save();

        return response()->json($asset);
    }
}
