<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeDeliverable;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeDeliverableController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'due_date'    => ['required', 'date'],
            'status'      => ['nullable', 'string'],
        ]);

        $deliverable = $this->service->addDeliverable($programme, $data);
        return response()->json(['message' => 'Deliverable added.', 'data' => $deliverable], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeDeliverable $deliverable): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'due_date'    => ['sometimes', 'date'],
            'status'      => ['nullable', 'string'],
        ]);

        $deliverable = $this->service->updateDeliverable($deliverable, $data);
        return response()->json(['message' => 'Deliverable updated.', 'data' => $deliverable]);
    }

    public function destroy(Programme $programme, ProgrammeDeliverable $deliverable): JsonResponse
    {
        $this->service->deleteDeliverable($deliverable);
        return response()->json(['message' => 'Deliverable deleted.']);
    }
}
