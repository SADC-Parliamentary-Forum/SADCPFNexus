<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetLabelBatch;
use App\Models\AssetLabelTemplate;
use App\Modules\Assets\Services\AssetLabelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AssetLabelController extends Controller
{
    public function __construct(private readonly AssetLabelService $labels) {}

    public function templates(Request $request): JsonResponse
    {
        $rows = AssetLabelTemplate::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function reprintQueue(Request $request): JsonResponse
    {
        $rows = Asset::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('label_status', 'reprint_required')
            ->orderBy('tag_number')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rows);
    }

    public function batches(Request $request): JsonResponse
    {
        $rows = AssetLabelBatch::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('template')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($rows);
    }

    public function print(Request $request): Response|JsonResponse
    {
        $data = $request->validate([
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => ['integer'],
            'template_id' => ['required', 'integer'],
            'reprint' => ['nullable', 'boolean'],
            'reprint_reason' => ['nullable', 'string', 'max:64'],
            'import_batch_id' => ['nullable', 'integer'],
        ]);
        $result = $this->labels->print(
            $request->user(),
            $data['asset_ids'],
            $data['template_id'],
            (bool) ($data['reprint'] ?? false),
            $data['reprint_reason'] ?? null,
            $data['import_batch_id'] ?? null
        );

        if ($request->boolean('json')) {
            return response()->json([
                'data' => [
                    'batch_number' => $result['batch']->batch_number,
                    'number_of_labels' => $result['batch']->number_of_labels,
                ],
            ], 201);
        }

        return $this->labels->pdfResponse($result);
    }
}
