<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetImportBatch;
use App\Models\AssetImportRaw;
use App\Models\AssetImportStaging;
use App\Modules\Assets\Services\AssetImportCommitService;
use App\Modules\Assets\Services\AssetImportService;
use App\Modules\Assets\Services\AssetReconciliationReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetImportController extends Controller
{
    public function __construct(
        private readonly AssetImportService $imports,
        private readonly AssetImportCommitService $commits,
        private readonly AssetReconciliationReportService $reports,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $rows = AssetImportBatch::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'mode' => ['nullable', 'in:legacy,template'],
            'category' => ['nullable', 'file', 'max:10240'],
            'location' => ['nullable', 'file', 'max:10240'],
            'staging' => ['nullable', 'file', 'max:10240'],
            'template' => ['nullable', 'file', 'max:10240'],
        ]);

        $batch = $this->imports->ingest([
            'category' => $request->file('category'),
            'location' => $request->file('location'),
            'staging' => $request->file('staging'),
            'template' => $request->file('template'),
        ], $request->user(), $request->input('mode', 'legacy'));

        return response()->json([
            'message' => 'Import staged for review.',
            'data' => $this->imports->preview($batch, $request->user()),
        ], 201);
    }

    public function show(Request $request, AssetImportBatch $assetImportBatch): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $this->imports->preview($assetImportBatch, $request->user())]);
    }

    public function staging(Request $request, AssetImportBatch $assetImportBatch): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);
        $query = $assetImportBatch->stagingRows()->orderBy('asset_tag');
        if ($filter = $request->input('filter')) {
            match ($filter) {
                'blocking' => $query->where('blocking', true),
                'missing_serial' => $query->whereNull('serial_number'),
                'missing_model' => $query->whereNull('model'),
                'missing_location' => $query->whereNull('legacy_location')->whereNull('location_id'),
                'unmapped_custodian' => $query->whereNull('custodian_user_id')->whereNull('custodian_department_id'),
                'approved' => $query->where('review_status', 'approved'),
                'excluded' => $query->where('review_status', 'excluded'),
                'pending' => $query->where('review_status', 'pending'),
                default => null,
            };
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('asset_tag', 'like', "%{$search}%")
                    ->orWhere('asset_name', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhere('legacy_location', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate($request->integer('per_page', 50)));
    }

    public function updateStaging(Request $request, AssetImportBatch $assetImportBatch, AssetImportStaging $staging): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);
        abort_unless((int) $staging->import_batch_id === (int) $assetImportBatch->id, 404);
        $row = $this->imports->updateStaging($assetImportBatch, $request->user(), $staging->id, $request->all());

        return response()->json(['data' => $row]);
    }

    public function approve(Request $request, AssetImportBatch $assetImportBatch): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);
        $data = $request->validate([
            'staging_ids' => ['nullable', 'array'],
            'staging_ids.*' => ['integer'],
            'all_non_blocking' => ['nullable', 'boolean'],
        ]);
        $count = $this->imports->approve(
            $assetImportBatch,
            $request->user(),
            $data['staging_ids'] ?? [],
            (bool) ($data['all_non_blocking'] ?? false)
        );

        return response()->json(['message' => "Approved {$count} record(s).", 'approved' => $count]);
    }

    public function exclude(Request $request, AssetImportBatch $assetImportBatch, AssetImportStaging $staging): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $row = $this->imports->exclude($assetImportBatch, $request->user(), $staging->id, $data['reason']);

        return response()->json(['data' => $row]);
    }

    public function raw(Request $request, AssetImportBatch $assetImportBatch, AssetImportRaw $raw): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);
        abort_unless((int) $raw->import_batch_id === (int) $assetImportBatch->id, 404);

        return response()->json(['data' => $raw]);
    }

    public function mapLocation(Request $request, AssetImportBatch $assetImportBatch): JsonResponse
    {
        $data = $request->validate([
            'legacy_location' => ['required', 'string', 'max:255'],
            'location_id' => ['required', 'integer', 'exists:asset_locations,id'],
        ]);
        $this->imports->confirmLocationMapping($assetImportBatch, $request->user(), $data['legacy_location'], $data['location_id']);

        return response()->json(['message' => 'Location mapping confirmed.']);
    }

    public function mapCustodian(Request $request, AssetImportBatch $assetImportBatch): JsonResponse
    {
        $data = $request->validate([
            'legacy_key' => ['required', 'string', 'max:255'],
            'custodian_type' => ['required', 'in:user,department,store,shared'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'location_id' => ['nullable', 'integer', 'exists:asset_locations,id'],
        ]);
        $this->imports->confirmCustodianMapping($assetImportBatch, $request->user(), $data['legacy_key'], $data);

        return response()->json(['message' => 'Custodian mapping confirmed.']);
    }

    public function commit(Request $request, AssetImportBatch $assetImportBatch): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);
        $data = $request->validate([
            'approve_non_blocking' => ['nullable', 'boolean'],
        ]);
        $result = $this->commits->commit(
            $assetImportBatch,
            $request->user(),
            (bool) ($data['approve_non_blocking'] ?? false)
        );

        return response()->json([
            'message' => $result['equation']['balanced'] ? 'Import committed.' : 'Import committed with incomplete reconciliation.',
            'data' => $result,
        ]);
    }

    public function report(Request $request, AssetImportBatch $assetImportBatch): JsonResponse
    {
        abort_unless((int) $assetImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $this->reports->build($assetImportBatch)]);
    }
}
