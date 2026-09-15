<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetAcquisitionBatch;
use App\Models\GoodsReceiptNote;
use App\Modules\Assets\Services\AssetAcquisitionBatchService;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AssetBatchController extends Controller
{
    public function __construct(private readonly AssetAcquisitionBatchService $batches) {}

    public function index(Request $request): JsonResponse
    {
        $this->assertView($request->user());
        $rows = AssetAcquisitionBatch::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->withCount('items')
            ->orderByDesc('id')
            ->paginate((int) $request->input('per_page', 25));

        $rows->getCollection()->transform(function (AssetAcquisitionBatch $batch) {
            return $this->batches->present($batch);
        });

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'description' => ['nullable', 'string', 'max:255'],
            'qty' => ['required', 'integer', 'min:1', 'max:500'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:8'],
            'supplier_id' => ['nullable', 'integer'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'purchase_order_id' => ['nullable', 'integer'],
            'goods_receipt_note_id' => ['nullable', 'integer'],
            'invoice_number' => ['nullable', 'string', 'max:64'],
            'funding_source_id' => ['nullable', 'integer'],
            'funding_source' => ['nullable', 'string', 'max:128'],
            'received_date' => ['nullable', 'date'],
            'category' => ['nullable', 'string', 'max:32'],
            'subcategory_code' => ['nullable', 'string', 'max:32'],
            'home_location_id' => ['nullable', 'integer'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);

        $batch = $this->batches->create($request->user(), $data);

        return response()->json(['data' => $this->batches->present($batch)], 201);
    }

    public function show(Request $request, AssetAcquisitionBatch $assetAcquisitionBatch): JsonResponse
    {
        $this->assertTenant($assetAcquisitionBatch, $request->user());
        $this->assertView($request->user());

        return response()->json(['data' => $this->batches->present($assetAcquisitionBatch)]);
    }

    public function createAssets(Request $request, AssetAcquisitionBatch $assetAcquisitionBatch): JsonResponse
    {
        $data = $request->validate([
            'category' => ['nullable', 'string', 'max:32'],
            'subcategory_code' => ['nullable', 'string', 'max:32'],
            'qty' => ['nullable', 'integer', 'min:1', 'max:500'],
            'name' => ['nullable', 'string', 'max:255'],
            'condition' => ['nullable', 'string', 'max:64'],
            'home_location_id' => ['nullable', 'integer'],
            'serial_numbers' => ['nullable', 'array'],
            'serial_numbers.*' => ['nullable', 'string', 'max:128'],
        ]);
        $batch = $this->batches->createAssets($assetAcquisitionBatch, $request->user(), $data);

        return response()->json(['data' => $this->batches->present($batch)]);
    }

    public function printLabels(Request $request, AssetAcquisitionBatch $assetAcquisitionBatch): Response|JsonResponse
    {
        $data = $request->validate([
            'template_id' => ['required', 'integer'],
            'json' => ['nullable', 'boolean'],
        ]);
        $result = $this->batches->printLabels($assetAcquisitionBatch, $request->user(), (int) $data['template_id']);
        if ($request->boolean('json')) {
            return response()->json([
                'data' => [
                    'batch_number' => $result['batch']->batch_number,
                    'number_of_labels' => $result['batch']->number_of_labels,
                ],
            ], 201);
        }

        return $this->batches->pdfResponse($result);
    }

    public function attachGrn(Request $request, AssetAcquisitionBatch $assetAcquisitionBatch): JsonResponse
    {
        $data = $request->validate([
            'goods_receipt_note_id' => ['required', 'integer'],
        ]);
        $grn = GoodsReceiptNote::query()->findOrFail($data['goods_receipt_note_id']);
        $batch = $this->batches->attachGrn($assetAcquisitionBatch, $grn, $request->user());

        return response()->json(['data' => $this->batches->present($batch)]);
    }

    private function assertView($user): void
    {
        if (! AssetAccess::canManageHandover($user) && ! AssetAccess::canManage($user) && ! $user->hasPermissionTo('assets.view')) {
            abort(403);
        }
    }

    private function assertTenant(AssetAcquisitionBatch $batch, $user): void
    {
        if ((int) $batch->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
