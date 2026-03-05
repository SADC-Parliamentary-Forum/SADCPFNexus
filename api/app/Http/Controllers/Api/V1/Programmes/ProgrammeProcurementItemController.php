<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeProcurementItem;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeProcurementItemController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'description'    => ['required', 'string', 'max:500'],
            'estimated_cost' => ['required', 'numeric', 'min:0'],
            'method'         => ['nullable', 'string', 'in:direct_purchase,three_quotations,tender'],
            'vendor'         => ['nullable', 'string', 'max:255'],
            'delivery_date'  => ['nullable', 'date'],
            'status'         => ['nullable', 'string', 'in:pending,ordered,delivered,cancelled'],
        ]);

        $item = $this->service->addProcurementItem($programme, $data);
        return response()->json(['message' => 'Procurement item added.', 'data' => $item], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeProcurementItem $procurementItem): JsonResponse
    {
        $data = $request->validate([
            'description'    => ['sometimes', 'string', 'max:500'],
            'estimated_cost' => ['sometimes', 'numeric', 'min:0'],
            'method'         => ['nullable', 'string', 'in:direct_purchase,three_quotations,tender'],
            'vendor'         => ['nullable', 'string', 'max:255'],
            'delivery_date'  => ['nullable', 'date'],
            'status'         => ['nullable', 'string', 'in:pending,ordered,delivered,cancelled'],
        ]);

        $item = $this->service->updateProcurementItem($procurementItem, $data);
        return response()->json(['message' => 'Procurement item updated.', 'data' => $item]);
    }

    public function destroy(Programme $programme, ProgrammeProcurementItem $procurementItem): JsonResponse
    {
        $this->service->deleteProcurementItem($procurementItem);
        return response()->json(['message' => 'Procurement item deleted.']);
    }
}
