<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Modules\Assets\Services\AssetQrService;
use App\Modules\Assets\Services\AssetService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    public function __construct(
        private readonly AssetService $assetService,
        private readonly AssetQrService $qr,
    ) {}

    /**
     * List assets. Optional ?assigned_to=me for current user's assigned assets only.
     * Optional ?status=pending|active|… filter.
     * Response includes computed age_years, age_display, current_value via model appends.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Asset::where('tenant_id', $user->tenant_id)
            ->with(['assignedUser:id,name,email', 'location']);

        if ($request->input('assigned_to') === 'me') {
            $query->where('assigned_to', $user->id);
        } elseif ($request->filled('assigned_to') && is_numeric($request->input('assigned_to'))) {
            $query->where('assigned_to', (int) $request->input('assigned_to'));
        }

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($class = $request->input('asset_class')) {
            $query->where('asset_class', $class);
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('asset_code', 'like', "%{$search}%")
                    ->orWhere('tag_number', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%");
            });
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
            'asset_code' => ['required', 'string', 'max:64', 'unique:assets,asset_code'],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:32', Rule::in($allowedCategories)],
            'status' => ['nullable', 'string', 'in:active,service_due,loan_out,retired'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'issued_at' => ['nullable', 'date'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'invoice_number' => ['nullable', 'string', 'max:64'],
            'invoice_path' => ['nullable', 'string', 'max:500'],
            'purchase_date' => ['nullable', 'date'],
            'purchase_value' => ['nullable', 'numeric', 'min:0'],
            'useful_life_years' => ['nullable', 'integer', 'min:1', 'max:100'],
            'salvage_value' => ['nullable', 'numeric', 'min:0'],
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
        $method = $validated['depreciation_method'] ?? 'straight_line';
        $computedValue = Asset::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $refDate, $method);
        $storedValue = $computedValue ?? (isset($validated['value']) ? (float) $validated['value'] : null);

        $asset = Asset::create([
            'tenant_id' => $user->tenant_id,
            'asset_code' => $validated['asset_code'],
            'name' => $validated['name'],
            'category' => $validated['category'],
            'status' => $validated['status'] ?? 'active',
            'assigned_to' => $validated['assigned_to'] ?? null,
            'issued_at' => $validated['issued_at'] ?? null,
            'value' => $storedValue,
            'notes' => $validated['notes'] ?? null,
            'invoice_number' => $validated['invoice_number'] ?? null,
            'invoice_path' => $validated['invoice_path'] ?? null,
            'purchase_date' => $validated['purchase_date'] ?? null,
            'purchase_value' => $purchaseValue,
            'useful_life_years' => $usefulLife,
            'salvage_value' => isset($validated['salvage_value']) ? (float) $validated['salvage_value'] : null,
            'depreciation_method' => $method,
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
     * Capitalise a pending (GRN-draft) asset into the active Fixed Asset Register.
     */
    public function capitalise(Request $request, Asset $asset): JsonResponse
    {
        $validated = $request->validate([
            'asset_code' => ['nullable', 'string', 'max:64', Rule::unique('assets', 'asset_code')->ignore($asset->id)],
            'category' => ['required', 'string', 'max:32'],
            'purchase_date' => ['required', 'date'],
            'purchase_value' => ['required', 'numeric', 'min:0'],
            'useful_life_years' => ['nullable', 'integer', 'min:1', 'max:100'],
            'salvage_value' => ['nullable', 'numeric', 'min:0'],
            'depreciation_method' => ['nullable', 'string', 'in:straight_line,declining_balance'],
            'asset_class' => ['nullable', 'string', 'in:capital,controlled'],
            'force_controlled' => ['nullable', 'boolean'],
            'serial_number' => ['nullable', 'string', 'max:128'],
            'tag_number' => ['nullable', 'string', 'max:64'],
            'allow_serial_duplicate' => ['nullable', 'boolean'],
            'funding_source' => ['nullable', 'string', 'max:128'],
            'location_id' => ['nullable', 'integer', 'exists:asset_locations,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $capitalised = $this->assetService->capitalise($asset, $validated, $request->user());
        $this->generateAndSaveQr($capitalised);

        return response()->json([
            'data' => $capitalised->fresh(),
            'message' => 'Asset capitalised into the Fixed Asset Register.',
        ]);
    }

    public function assign(Request $request, Asset $asset): JsonResponse
    {
        $validated = $request->validate([
            'assigned_to' => ['required', 'integer', 'exists:users,id'],
            'department' => ['nullable', 'string', 'max:128'],
            'location_id' => ['nullable', 'integer', 'exists:asset_locations,id'],
            'assignment_type' => ['nullable', 'string', 'in:custody,loan,shared'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $assignee = \App\Models\User::findOrFail($validated['assigned_to']);
        $updated = $this->assetService->assign($asset, $assignee, $request->user(), $validated);

        return response()->json(['data' => $updated, 'message' => 'Asset assigned.']);
    }

    public function acknowledge(Request $request, Asset $asset): JsonResponse
    {
        $updated = $this->assetService->acknowledge($asset, $request->user());

        return response()->json(['data' => $updated, 'message' => 'Custody acknowledged.']);
    }

    public function transfer(Request $request, Asset $asset): JsonResponse
    {
        $validated = $request->validate([
            'to_user_id' => ['required', 'integer', 'exists:users,id'],
            'department' => ['nullable', 'string', 'max:128'],
            'location_id' => ['nullable', 'integer', 'exists:asset_locations,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $to = \App\Models\User::findOrFail($validated['to_user_id']);
        $updated = $this->assetService->transfer($asset, $to, $request->user(), $validated);

        return response()->json(['data' => $updated, 'message' => 'Asset transferred.']);
    }

    public function returnAsset(Request $request, Asset $asset): JsonResponse
    {
        $validated = $request->validate([
            'location_id' => ['nullable', 'integer', 'exists:asset_locations,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $updated = $this->assetService->returnAsset($asset, $request->user(), $validated);

        return response()->json(['data' => $updated, 'message' => 'Asset returned.']);
    }

    public function markCondition(Request $request, Asset $asset): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:missing,damaged,lost,stolen,under_investigation'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $updated = $this->assetService->markCondition($asset, $validated['status'], $request->user(), $validated['notes'] ?? null);

        return response()->json(['data' => $updated, 'message' => 'Asset condition updated.']);
    }

    public function assignmentHistory(Request $request, Asset $asset): JsonResponse
    {
        $user = $request->user();
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        return response()->json([
            'data' => $asset->assignmentHistories()->orderByDesc('assigned_at')->get(),
        ]);
    }

    public function registerExport(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        $user = $request->user();
        $rows = Asset::where('tenant_id', $user->tenant_id)
            ->where('status', '!=', 'pending')
            ->orderBy('asset_code')
            ->get();

        if ($request->input('format') === 'json') {
            return response()->json(['data' => $rows]);
        }

        $filename = 'fixed-asset-register-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'asset_code', 'tag_number', 'name', 'category', 'asset_class', 'status',
                'serial_number', 'purchase_date', 'purchase_value', 'funding_source',
                'useful_life_years', 'accumulated_depreciation', 'book_value', 'location_id', 'assigned_to',
            ]);
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r->asset_code, $r->tag_number, $r->name, $r->category, $r->asset_class, $r->status,
                    $r->serial_number, optional($r->purchase_date)?->toDateString(), $r->purchase_value, $r->funding_source,
                    $r->useful_life_years, $r->accumulated_depreciation, $r->book_value ?? $r->current_value, $r->location_id, $r->assigned_to,
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $base = Asset::where('tenant_id', $tenantId);

        return response()->json([
            'data' => [
                'total' => (clone $base)->count(),
                'pending' => (clone $base)->where('status', 'pending')->count(),
                'capital' => (clone $base)->where('asset_class', 'capital')->count(),
                'controlled' => (clone $base)->where('asset_class', 'controlled')->count(),
                'assigned' => (clone $base)->whereNotNull('assigned_to')->whereNotIn('status', ['disposed', 'retired', 'pending'])->count(),
                'missing' => (clone $base)->where('status', 'missing')->count(),
                'pending_disposal' => (clone $base)->where('status', 'pending_disposal')->count(),
                'warranty_expiring_30d' => (clone $base)->whereNotNull('warranty_expiry')
                    ->whereBetween('warranty_expiry', [now()->toDateString(), now()->addDays(30)->toDateString()])->count(),
            ],
        ]);
    }

    /**
     * Reject capitalisation of a pending draft (retire with reason).
     */
    public function rejectCapitalisation(Request $request, Asset $asset): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $rejected = $this->assetService->rejectCapitalisation($asset, $validated['reason'], $request->user());

        return response()->json([
            'data' => $rejected,
            'message' => 'Pending capitalisation rejected.',
        ]);
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
            'asset_code' => ['required', 'string', 'max:64', Rule::unique('assets', 'asset_code')->ignore($asset->id)],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:32', Rule::in($allowedCategories)],
            'status' => ['nullable', 'string', 'in:active,service_due,loan_out,retired'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'issued_at' => ['nullable', 'date'],
            'value' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'invoice_number' => ['nullable', 'string', 'max:64'],
            'invoice_path' => ['nullable', 'string', 'max:500'],
            'purchase_date' => ['nullable', 'date'],
            'purchase_value' => ['nullable', 'numeric', 'min:0'],
            'useful_life_years' => ['nullable', 'integer', 'min:1', 'max:100'],
            'salvage_value' => ['nullable', 'numeric', 'min:0'],
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
        $method = $validated['depreciation_method'] ?? 'straight_line';
        $computedValue = Asset::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $refDate, $method);
        $storedValue = $computedValue ?? (isset($validated['value']) ? (float) $validated['value'] : null);

        $oldAssetCode = $asset->asset_code;

        $asset->asset_code = $validated['asset_code'];
        $asset->name = $validated['name'];
        $asset->category = $validated['category'];
        $asset->status = $validated['status'] ?? 'active';
        $asset->assigned_to = $validated['assigned_to'] ?? null;
        $asset->issued_at = $validated['issued_at'] ?? null;
        $asset->value = $storedValue;
        $asset->notes = $validated['notes'] ?? null;
        $asset->invoice_number = $validated['invoice_number'] ?? null;
        $asset->invoice_path = $validated['invoice_path'] ?? null;
        $asset->purchase_date = $validated['purchase_date'] ?? null;
        $asset->purchase_value = $purchaseValue;
        $asset->useful_life_years = $usefulLife;
        $asset->salvage_value = isset($validated['salvage_value']) ? (float) $validated['salvage_value'] : null;
        $asset->depreciation_method = $method;
        $asset->save();

        if ($asset->asset_code !== $oldAssetCode || empty($asset->qr_token)) {
            $this->qr->generate($asset, $request->user(), (bool) $asset->qr_token);
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
        if (! $asset->qr_path || ! Storage::disk('local')->exists($asset->qr_path) || empty($asset->qr_token)) {
            $this->qr->ensure($asset, $user);
            $asset->refresh();
        }
        if (! $asset->qr_path || ! Storage::disk('local')->exists($asset->qr_path)) {
            abort(404, 'QR code could not be generated.');
        }
        $contents = Storage::disk('local')->get($asset->qr_path);
        $isPng = str_ends_with($asset->qr_path, '.png');

        return response($contents, 200, [
            'Content-Type' => $isPng ? 'image/png' : 'image/svg+xml',
            'Content-Disposition' => 'inline; filename="asset-'.$asset->asset_code.'-qr.'.($isPng ? 'png' : 'svg').'"',
        ]);
    }

    /**
     * Generate an opaque QR URL token and persist the SVG image.
     */
    private function generateAndSaveQr(Asset $asset, $actor = null): void
    {
        $this->qr->ensure($asset, $actor);
    }

    /**
     * Retire (soft-delete via status change) or hard-delete an asset. Requires assets.admin.
     */
    public function destroy(Request $request, Asset $asset): JsonResponse
    {
        $user = $request->user();
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Only system administrators or asset managers can delete assets.');
        }
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if ($asset->isDisposed()) {
            return response()->json(['message' => 'Disposed assets are retained for audit; status unchanged.'], 422);
        }

        // Mark as retired rather than hard-delete to preserve audit history
        $asset->status = 'retired';
        $asset->save();

        return response()->json(['message' => 'Asset retired.']);
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
        $dir = 'invoices/assets/'.$asset->tenant_id;
        $filename = $asset->id.'_'.Str::random(8).'.'.$safeExt;
        $path = $file->storeAs($dir, $filename, ['disk' => 'local']);

        if ($asset->invoice_path && Storage::disk('local')->exists($asset->invoice_path)) {
            Storage::disk('local')->delete($asset->invoice_path);
        }

        $asset->invoice_path = $path;
        $asset->save();

        return response()->json($asset);
    }
}
