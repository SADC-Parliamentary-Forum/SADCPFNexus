<?php
namespace App\Http\Controllers\Api\V1\Imprest;

use App\Http\Controllers\Controller;
use App\Models\ImprestRequest;
use App\Modules\Imprest\Services\ImprestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImprestController extends Controller
{
    public function __construct(private readonly ImprestService $imprestService) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'per_page']);
        return response()->json($this->imprestService->list($filters, $request->user()));
    }

    public function show(ImprestRequest $imprestRequest): JsonResponse
    {
        return response()->json($imprestRequest->load(['requester', 'approver']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'budget_line'               => ['required', 'string', 'max:200'],
            'amount_requested'          => ['required', 'numeric', 'min:1'],
            'currency'                  => ['nullable', 'string', 'size:3'],
            'expected_liquidation_date' => ['required', 'date', 'after:today'],
            'purpose'                   => ['required', 'string', 'max:2000'],
            'justification'             => ['nullable', 'string', 'max:2000'],
        ]);

        $imprest = $this->imprestService->create($data, $request->user());
        return response()->json(['message' => 'Imprest request created.', 'data' => $imprest], 201);
    }

    public function update(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate([
            'budget_line'               => ['sometimes', 'string', 'max:200'],
            'amount_requested'          => ['sometimes', 'numeric', 'min:1'],
            'expected_liquidation_date' => ['sometimes', 'date'],
            'purpose'                   => ['sometimes', 'string', 'max:2000'],
            'justification'             => ['nullable', 'string', 'max:2000'],
        ]);

        $imprest = $this->imprestService->update($imprestRequest, $data, $request->user());
        return response()->json(['message' => 'Imprest request updated.', 'data' => $imprest]);
    }

    public function destroy(ImprestRequest $imprestRequest): JsonResponse
    {
        if (!$imprestRequest->isDraft()) {
            return response()->json(['message' => 'Only draft requests can be deleted.'], 422);
        }
        $imprestRequest->delete();
        return response()->json(['message' => 'Imprest request deleted.']);
    }

    public function submit(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $imprest = $this->imprestService->submit($imprestRequest, $request->user());
        return response()->json(['message' => 'Imprest request submitted.', 'data' => $imprest]);
    }

    public function approve(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate(['amount_approved' => ['nullable', 'numeric', 'min:0']]);
        $imprest = $this->imprestService->approve($imprestRequest, $data, $request->user());
        return response()->json(['message' => 'Imprest request approved.', 'data' => $imprest]);
    }

    public function reject(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $imprest = $this->imprestService->reject($imprestRequest, $data['reason'], $request->user());
        return response()->json(['message' => 'Imprest request rejected.', 'data' => $imprest]);
    }

    public function retire(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate([
            'amount_liquidated'  => ['required', 'numeric', 'min:0'],
            'notes'              => ['nullable', 'string', 'max:2000'],
            'receipts_attached'  => ['nullable', 'boolean'],
        ]);
        $imprest = $this->imprestService->retire($imprestRequest, $data, $request->user());
        return response()->json(['message' => 'Imprest request retired successfully.', 'data' => $imprest]);
    }
}
