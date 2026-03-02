<?php
namespace App\Http\Controllers\Api\V1\Travel;

use App\Http\Controllers\Controller;
use App\Models\TravelRequest;
use App\Modules\Travel\Services\TravelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TravelController extends Controller
{
    public function __construct(private readonly TravelService $travelService) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'per_page']);
        return response()->json($this->travelService->list($filters, $request->user()));
    }

    public function show(TravelRequest $travelRequest): JsonResponse
    {
        return response()->json(
            $travelRequest->load(['requester', 'approver', 'itineraries'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'purpose'             => ['required', 'string', 'max:500'],
            'departure_date'      => ['required', 'date', 'after_or_equal:today'],
            'return_date'         => ['required', 'date', 'after_or_equal:departure_date'],
            'destination_country' => ['required', 'string', 'max:100'],
            'destination_city'    => ['nullable', 'string', 'max:100'],
            'estimated_dsa'       => ['nullable', 'numeric', 'min:0'],
            'currency'            => ['nullable', 'string', 'size:3'],
            'justification'       => ['nullable', 'string', 'max:2000'],
            'itineraries'         => ['nullable', 'array'],
            'itineraries.*.from_location'  => ['required_with:itineraries', 'string'],
            'itineraries.*.to_location'    => ['required_with:itineraries', 'string'],
            'itineraries.*.travel_date'    => ['required_with:itineraries', 'date'],
            'itineraries.*.transport_mode' => ['required_with:itineraries', 'string'],
            'itineraries.*.days_count'     => ['nullable', 'integer', 'min:1'],
        ]);

        $travel = $this->travelService->create($data, $request->user());

        return response()->json(['message' => 'Travel request created.', 'data' => $travel], 201);
    }

    public function update(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'purpose'             => ['sometimes', 'string', 'max:500'],
            'departure_date'      => ['sometimes', 'date'],
            'return_date'         => ['sometimes', 'date', 'after_or_equal:departure_date'],
            'destination_country' => ['sometimes', 'string', 'max:100'],
            'destination_city'    => ['nullable', 'string', 'max:100'],
            'estimated_dsa'       => ['nullable', 'numeric', 'min:0'],
            'justification'       => ['nullable', 'string', 'max:2000'],
        ]);

        $travel = $this->travelService->update($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Travel request updated.', 'data' => $travel]);
    }

    public function destroy(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->travelService->delete($travelRequest);
        return response()->json(['message' => 'Travel request deleted.']);
    }

    public function submit(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $travel = $this->travelService->submit($travelRequest, $request->user());
        return response()->json(['message' => 'Travel request submitted.', 'data' => $travel]);
    }

    public function approve(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $travel = $this->travelService->approve($travelRequest, $request->user());
        return response()->json(['message' => 'Travel request approved.', 'data' => $travel]);
    }

    public function reject(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $travel = $this->travelService->reject($travelRequest, $data['reason'], $request->user());
        return response()->json(['message' => 'Travel request rejected.', 'data' => $travel]);
    }
}
