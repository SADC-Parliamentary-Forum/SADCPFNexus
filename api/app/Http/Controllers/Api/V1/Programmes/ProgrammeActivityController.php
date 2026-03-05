<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeActivity;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeActivityController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'name'              => ['required', 'string', 'max:500'],
            'description'       => ['nullable', 'string'],
            'budget_allocation' => ['nullable', 'numeric', 'min:0'],
            'responsible'       => ['nullable', 'string', 'max:255'],
            'location'          => ['nullable', 'string', 'max:255'],
            'start_date'        => ['required', 'date'],
            'end_date'          => ['required', 'date', 'after_or_equal:start_date'],
            'status'            => ['nullable', 'string'],
        ]);

        $activity = $this->service->addActivity($programme, $data);
        return response()->json(['message' => 'Activity added.', 'data' => $activity], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeActivity $activity): JsonResponse
    {
        $data = $request->validate([
            'name'              => ['sometimes', 'string', 'max:500'],
            'description'       => ['nullable', 'string'],
            'budget_allocation' => ['nullable', 'numeric', 'min:0'],
            'responsible'       => ['nullable', 'string', 'max:255'],
            'location'          => ['nullable', 'string', 'max:255'],
            'start_date'        => ['sometimes', 'date'],
            'end_date'          => ['sometimes', 'date'],
            'status'            => ['nullable', 'string'],
        ]);

        $activity = $this->service->updateActivity($activity, $data);
        return response()->json(['message' => 'Activity updated.', 'data' => $activity]);
    }

    public function destroy(Programme $programme, ProgrammeActivity $activity): JsonResponse
    {
        $this->service->deleteActivity($activity);
        return response()->json(['message' => 'Activity deleted.']);
    }
}
