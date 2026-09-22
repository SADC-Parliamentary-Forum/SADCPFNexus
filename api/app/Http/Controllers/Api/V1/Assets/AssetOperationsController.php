<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetCheckout;
use App\Models\AssetIncident;
use App\Models\AssetLocation;
use App\Models\AssetSubcategory;
use App\Models\AssetTimelineEvent;
use App\Models\AssetTransfer;
use App\Models\Attachment;
use App\Models\User;
use App\Modules\Assets\Reporting\AssetReportCatalogue;
use App\Modules\Assets\Services\AssetAssignedToUserReportService;
use App\Modules\Assets\Services\AssetCheckoutService;
use App\Modules\Assets\Services\AssetIncidentService;
use App\Modules\Assets\Services\AssetReportEngine;
use App\Modules\Assets\Services\AssetService;
use App\Modules\Assets\Services\AssetTimelineService;
use App\Modules\Assets\Services\AssetTransferService;
use App\Modules\Assets\Support\AssetAccess;
use App\Modules\Documents\Services\ModuleDocumentBridge;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AssetOperationsController extends Controller
{
    public const DOCUMENT_TYPES = [
        'invoice', 'quotation', 'po', 'delivery_note', 'warranty', 'procurement_approval',
        'inspection', 'maintenance_report', 'repair_invoice', 'insurance', 'police_report',
        'disposal_approval', 'transfer_acknowledgement', 'photo_primary', 'photo_front',
        'photo_rear', 'photo_serial', 'photo_damage', 'photo_verification', 'photo_repair', 'other',
    ];

    public function __construct(
        private readonly AssetCheckoutService $checkouts,
        private readonly AssetTransferService $transfers,
        private readonly AssetIncidentService $incidents,
        private readonly AssetService $assets,
        private readonly AssetTimelineService $timeline,
        private readonly ModuleDocumentBridge $documents,
    ) {}

    public function move(Request $request, Asset $asset): JsonResponse
    {
        $this->assertTenant($asset, $request->user());
        if (! AssetAccess::canManage($request->user())) {
            abort(403);
        }
        $data = $request->validate([
            'location_id' => ['required', 'integer', 'exists:asset_locations,id'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);
        $updated = $this->assets->setLocation($asset, (int) $data['location_id'], $request->user(), $data['reason'] ?? 'Move Asset');
        $this->timeline->record($updated, 'LOCATION_CHANGED', 'Moved asset', $request->user(), $data);

        return response()->json(['data' => $updated->fresh(['location'])]);
    }

    public function checkout(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'borrower_id' => ['required', 'integer'],
            'purpose' => ['nullable', 'string', 'max:500'],
            'expected_return_at' => ['nullable', 'date'],
            'condition_out' => ['nullable', 'string', 'max:64'],
            'accessories' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json(['data' => $this->checkouts->checkout($asset, $request->user(), $data)], 201);
    }

    public function returnCheckout(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'condition_in' => ['nullable', 'string', 'max:64'],
            'damage_reported' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json(['data' => $this->checkouts->returnCheckout($asset, $request->user(), $data)]);
    }

    public function checkoutsIndex(Request $request): JsonResponse
    {
        $query = AssetCheckout::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['asset:id,asset_code,tag_number,name,status', 'borrower:id,name']);
        if ($request->boolean('open')) {
            $query->whereNull('returned_at');
        }

        return response()->json($query->orderByDesc('id')->paginate($request->integer('per_page', 50)));
    }

    public function initiateTransfer(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'to_user_id' => ['required', 'integer'],
            'reason' => ['nullable', 'string', 'max:500'],
            'condition' => ['nullable', 'string', 'max:64'],
            'override_reason' => ['nullable', 'string', 'in:employee_unavailable,separated,lost,admin_correction'],
            'override_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json(['data' => $this->transfers->initiate($asset, $request->user(), $data)], 201);
    }

    public function transfersIndex(Request $request): JsonResponse
    {
        $rows = AssetTransfer::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['asset:id,asset_code,tag_number,name', 'fromUser:id,name', 'toUser:id,name'])
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rows);
    }

    public function confirmOutgoing(Request $request, AssetTransfer $assetTransfer): JsonResponse
    {
        return response()->json(['data' => $this->transfers->confirmOutgoing($assetTransfer, $request->user())]);
    }

    public function acceptTransfer(Request $request, AssetTransfer $assetTransfer): JsonResponse
    {
        return response()->json(['data' => $this->transfers->accept($assetTransfer, $request->user())]);
    }

    public function reportLost(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'date_noticed' => ['nullable', 'date'],
            'last_seen_date' => ['nullable', 'date'],
            'last_known_location' => ['nullable', 'string', 'max:255'],
            'circumstances' => ['nullable', 'string', 'max:4000'],
        ]);

        return response()->json(['data' => $this->incidents->reportLost($asset, $request->user(), $data)]);
    }

    public function reportStolen(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'date_noticed' => ['nullable', 'date'],
            'circumstances' => ['nullable', 'string', 'max:4000'],
            'police_station' => ['nullable', 'string', 'max:255'],
            'police_case_number' => ['nullable', 'string', 'max:64'],
            'police_reported_on' => ['nullable', 'date'],
            'insurer' => ['nullable', 'string', 'max:255'],
            'claim_reference' => ['nullable', 'string', 'max:64'],
        ]);

        return response()->json(['data' => $this->incidents->reportStolen($asset, $request->user(), $data)]);
    }

    public function reportFound(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:4000'],
            'location' => ['nullable', 'string', 'max:255'],
        ]);
        $this->incidents->reportFound($asset, $request->user(), $data, false);

        return response()->json(['data' => $asset->fresh()]);
    }

    public function incidentsIndex(Request $request): JsonResponse
    {
        $query = AssetIncident::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('asset:id,asset_code,tag_number,name,status');
        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        return response()->json($query->orderByDesc('id')->paginate(50));
    }

    public function timeline(Request $request, Asset $asset): JsonResponse
    {
        $this->assertTenant($asset, $request->user());
        $query = AssetTimelineEvent::query()->where('asset_id', $asset->id)->orderByDesc('occurred_at');
        if ($request->filled('type')) {
            $query->where('event_type', $request->string('type'));
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }

    public function documents(Request $request, Asset $asset): JsonResponse
    {
        $this->assertTenant($asset, $request->user());

        return response()->json(['data' => $asset->attachments()->with('uploader:id,name')->get()]);
    }

    public function storeDocument(Request $request, Asset $asset): JsonResponse
    {
        $this->assertTenant($asset, $request->user());
        if (! AssetAccess::canManage($request->user())) {
            abort(403);
        }
        $request->validate([
            'file' => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:'.implode(',', self::DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        UploadContentSniffer::assertAllowed($file);
        $attachment = $this->documents->storeAttachment($request->user(), $asset, $file, [
            'document_type' => $request->input('document_type', 'other'),
            'module' => 'assets',
        ]);

        return response()->json(['data' => $attachment], 201);
    }

    public function destroyDocument(Request $request, Asset $asset, Attachment $attachment): JsonResponse
    {
        $this->assertTenant($asset, $request->user());
        if (! AssetAccess::canManage($request->user())) {
            abort(403);
        }
        if ($attachment->attachable_type !== Asset::class || (int) $attachment->attachable_id !== (int) $asset->id) {
            abort(404);
        }
        $this->documents->unlinkAttachment($request->user(), $attachment);

        return response()->json(['message' => 'Attachment unlinked.']);
    }

    public function downloadDocument(Request $request, Asset $asset, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->assertTenant($asset, $request->user());
        if ($attachment->attachable_type !== Asset::class || (int) $attachment->attachable_id !== (int) $asset->id) {
            abort(404);
        }
        if (! $attachment->storage_path || ! Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return response()->streamDownload(function () use ($attachment) {
            $stream = Storage::disk('local')->readStream($attachment->storage_path);
            if (is_resource($stream)) {
                fpassthru($stream);
            }
        }, $attachment->original_filename);
    }

    public function reportCatalogue(): JsonResponse
    {
        return response()->json(['data' => AssetReportCatalogue::all()]);
    }

    public function assignedToUserReport(Request $request, AssetAssignedToUserReportService $reports): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'mode' => ['nullable', 'string', 'max:32'],
            'as_of' => ['nullable', 'date'],
        ]);

        return response()->json($reports->run(
            $request->user(),
            (int) $data['user_id'],
            $data['mode'] ?? 'current',
            $data['as_of'] ?? null,
        ));
    }

    public function runGovernedReport(Request $request, AssetReportEngine $engine): JsonResponse
    {
        $data = $request->validate([
            'report_id' => ['required', 'string', 'max:8'],
            'user_id' => ['nullable', 'integer'],
            'asset_id' => ['nullable', 'integer'],
            'mode' => ['nullable', 'string', 'max:32'],
            'as_of' => ['nullable', 'date'],
            'department' => ['nullable', 'string', 'max:120'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return response()->json($engine->run($request->user(), strtoupper($data['report_id']), $data));
    }

    public function exportGovernedReport(Request $request, AssetReportEngine $engine): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $data = $request->validate([
            'report_id' => ['required', 'string', 'max:8'],
            'format' => ['required', 'in:pdf,xlsx,csv'],
            'official' => ['nullable', 'boolean'],
            'intent' => ['nullable', 'in:export,print'],
            'user_id' => ['nullable', 'integer'],
            'asset_id' => ['nullable', 'integer'],
            'mode' => ['nullable', 'string', 'max:32'],
            'as_of' => ['nullable', 'date'],
            'department' => ['nullable', 'string', 'max:120'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return $engine->export(
            $request->user(),
            strtoupper($data['report_id']),
            $data,
            $data['format'],
            $request->boolean('official'),
        );
    }

    public function reports(Request $request, string $type): JsonResponse
    {
        $tenantId = (int) $request->user()->tenant_id;
        $base = Asset::query()->where('tenant_id', $tenantId);
        $rows = match ($type) {
            'unassigned' => (clone $base)->whereNull('assigned_to')->whereNotIn('status', Asset::DISPOSED_STATUSES)->limit(500)->get(),
            'missing-labels', 'never-printed' => (clone $base)->where(function ($q) {
                $q->whereNull('label_status')->orWhere('label_status', 'never_printed');
            })->limit(500)->get(),
            'reprint' => (clone $base)->where('label_status', 'reprint_required')->limit(500)->get(),
            'unverified' => (clone $base)->where(function ($q) {
                $q->whereNull('last_verified_at')->orWhere('verification_status', '!=', 'verified');
            })->limit(500)->get(),
            'missing' => (clone $base)->whereIn('status', ['missing', 'lost'])->limit(500)->get(),
            'stolen' => (clone $base)->where('status', 'stolen')->limit(500)->get(),
            'warranty' => (clone $base)->whereNotNull('warranty_expiry')->whereBetween('warranty_expiry', [now()->toDateString(), now()->addDays(90)->toDateString()])->limit(500)->get(),
            'replacement' => (clone $base)->where(function ($q) {
                $q->whereNotNull('replacement_due_on')->where('replacement_due_on', '<=', now()->toDateString())
                    ->orWhereIn('condition', ['poor', 'damaged', 'beyond_economic_repair']);
            })->limit(500)->get(),
            'by-category' => (clone $base)->orderBy('category')->limit(500)->get(),
            'by-location' => (clone $base)->orderBy('location_id')->limit(500)->get(),
            'by-custodian' => (clone $base)->whereNotNull('assigned_to')->limit(500)->get(),
            'by-funding' => (clone $base)->orderBy('funding_source')->limit(500)->get(),
            'disposal' => (clone $base)->whereIn('status', Asset::DISPOSED_STATUSES)->limit(500)->get(),
            'valuation' => (clone $base)->limit(500)->get(),
            default => abort(404, 'Unknown report.'),
        };

        if ($type === 'valuation' && ! AssetAccess::canViewFinancials($request->user())) {
            abort(403);
        }

        return response()->json([
            'data' => $rows->map(fn (Asset $a) => [
                'id' => $a->id,
                'tag_number' => $a->tag_number ?: $a->asset_code,
                'name' => $a->name,
                'status' => $a->status,
                'location_id' => $a->location_id,
                'assigned_to' => $a->assigned_to,
                'condition' => $a->condition,
                'warranty_expiry' => $a->warranty_expiry,
                'purchase_value' => AssetAccess::canViewFinancials($request->user()) ? $a->purchase_value : null,
                'book_value' => AssetAccess::canViewFinancials($request->user()) ? $a->book_value : null,
            ]),
        ]);
    }

    public function storeSubcategory(Request $request, \App\Models\AssetCategory $assetCategory): JsonResponse
    {
        $user = $request->user();
        if ((int) $assetCategory->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! AssetAccess::canManage($user) && ! $user->hasAnyPermission(['assets.create', 'assets.edit', 'assets.import'])) {
            abort(403);
        }
        $data = $request->validate([
            'code' => ['required', 'string', 'max:32'],
            'name' => ['required', 'string', 'max:255'],
        ]);
        $row = AssetSubcategory::create([
            'tenant_id' => $user->tenant_id,
            'asset_category_id' => $assetCategory->id,
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function listSubcategories(Request $request, \App\Models\AssetCategory $assetCategory): JsonResponse
    {
        if ((int) $assetCategory->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json(['data' => $assetCategory->subcategories()->orderBy('code')->get()]);
    }

    public function updateLocation(Request $request, AssetLocation $assetLocation): JsonResponse
    {
        $user = $request->user();
        if ((int) $assetLocation->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! AssetAccess::canManage($user)) {
            abort(403);
        }
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'building' => ['nullable', 'string', 'max:128'],
            'floor' => ['nullable', 'string', 'max:64'],
            'room' => ['nullable', 'string', 'max:64'],
            'is_active' => ['nullable', 'boolean'],
            'parent_id' => ['nullable', 'integer'],
        ]);
        $assetLocation->update($data);

        return response()->json(['data' => $assetLocation->fresh()]);
    }

    private function assertTenant(Asset $asset, User $user): void
    {
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
