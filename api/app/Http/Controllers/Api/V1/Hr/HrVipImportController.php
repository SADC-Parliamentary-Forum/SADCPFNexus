<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrVipImportBatch;
use App\Modules\Hr\Import\HrVipImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrVipImportController extends Controller
{
    public function __construct(private readonly HrVipImportService $imports) {}

    public function index(Request $request): JsonResponse
    {
        $rows = HrVipImportBatch::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->withCount('files')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['file', 'max:51200'],
        ]);

        $batch = $this->imports->createBatch($request->user());
        $batch = $this->imports->ingest($batch, $data['files'], $request->user());

        return response()->json([
            'message' => 'Sage VIP pack staged.',
            'data' => $batch,
        ], 201);
    }

    public function show(Request $request, HrVipImportBatch $hrVipImportBatch): JsonResponse
    {
        abort_unless((int) $hrVipImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $hrVipImportBatch->load('files')]);
    }

    public function preview(Request $request, HrVipImportBatch $hrVipImportBatch): JsonResponse
    {
        abort_unless((int) $hrVipImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json([
            'data' => $this->imports->preview($hrVipImportBatch, $request->user()),
        ]);
    }

    public function commit(Request $request, HrVipImportBatch $hrVipImportBatch): JsonResponse
    {
        abort_unless((int) $hrVipImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);

        $batch = $this->imports->commit($hrVipImportBatch, $request->user());

        return response()->json([
            'message' => 'HR VIP import committed.',
            'data' => $batch,
        ]);
    }
}
