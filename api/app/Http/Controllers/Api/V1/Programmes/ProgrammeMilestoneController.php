<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeMilestone;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeMilestoneController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'name'           => ['required', 'string', 'max:500'],
            'target_date'    => ['required', 'date'],
            'achieved_date'  => ['nullable', 'date'],
            'completion_pct' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status'         => ['nullable', 'string'],
        ]);

        $milestone = $this->service->addMilestone($programme, $data);
        return response()->json(['message' => 'Milestone added.', 'data' => $milestone], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeMilestone $milestone): JsonResponse
    {
        $data = $request->validate([
            'name'           => ['sometimes', 'string', 'max:500'],
            'target_date'    => ['sometimes', 'date'],
            'achieved_date'  => ['nullable', 'date'],
            'completion_pct' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status'         => ['nullable', 'string'],
        ]);

        $milestone = $this->service->updateMilestone($milestone, $data);
        return response()->json(['message' => 'Milestone updated.', 'data' => $milestone]);
    }

    public function destroy(Programme $programme, ProgrammeMilestone $milestone): JsonResponse
    {
        $this->service->deleteMilestone($milestone);
        return response()->json(['message' => 'Milestone deleted.']);
    }
}
