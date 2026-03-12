<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'per_page']);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function show(Programme $programme): JsonResponse
    {
        return response()->json($this->service->get($programme));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'                   => ['required', 'string', 'max:500'],
            'strategic_pillar'        => ['nullable', 'string', 'max:255'],
            'implementing_department' => ['nullable', 'string', 'max:255'],
            'background'              => ['nullable', 'string'],
            'overall_objective'       => ['nullable', 'string'],
            'primary_currency'        => ['nullable', 'string', 'size:3'],
            'base_currency'           => ['nullable', 'string', 'size:3'],
            'exchange_rate'           => ['nullable', 'numeric', 'min:0'],
            'contingency_pct'         => ['nullable', 'numeric', 'min:0', 'max:100'],
            'total_budget'            => ['nullable', 'numeric', 'min:0'],
            'funding_source'          => ['nullable', 'string', 'max:255'],
            'responsible_officer_id'  => ['nullable', 'integer', 'exists:users,id'],
            'start_date'              => ['nullable', 'date'],
            'end_date'                => ['nullable', 'date', 'after_or_equal:start_date'],
            'travel_required'         => ['nullable', 'boolean'],
            'delegates_count'         => ['nullable', 'integer', 'min:0'],
            'procurement_required'    => ['nullable', 'boolean'],
            'strategic_alignment'     => ['nullable', 'array'],
            'supporting_departments'  => ['nullable', 'array'],
            'specific_objectives'     => ['nullable', 'array'],
            'expected_outputs'        => ['nullable', 'array'],
            'target_beneficiaries'    => ['nullable', 'array'],
            'member_states'           => ['nullable', 'array'],
            'travel_services'         => ['nullable', 'array'],
            'media_options'           => ['nullable', 'array'],
            'activities'              => ['nullable', 'array'],
            'milestones'              => ['nullable', 'array'],
            'deliverables'            => ['nullable', 'array'],
            'budget_lines'            => ['nullable', 'array'],
            'procurement_items'       => ['nullable', 'array'],
        ]);

        $programme = $this->service->create($data, $request->user());
        return response()->json(['message' => 'Programme created.', 'data' => $programme], 201);
    }

    public function update(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'title'                   => ['sometimes', 'string', 'max:500'],
            'strategic_pillar'        => ['nullable', 'string', 'max:255'],
            'implementing_department' => ['nullable', 'string', 'max:255'],
            'background'              => ['nullable', 'string'],
            'overall_objective'       => ['nullable', 'string'],
            'primary_currency'        => ['nullable', 'string', 'size:3'],
            'base_currency'           => ['nullable', 'string', 'size:3'],
            'exchange_rate'           => ['nullable', 'numeric', 'min:0'],
            'contingency_pct'         => ['nullable', 'numeric', 'min:0', 'max:100'],
            'total_budget'            => ['nullable', 'numeric', 'min:0'],
            'funding_source'          => ['nullable', 'string', 'max:255'],
            'responsible_officer_id'  => ['nullable', 'integer', 'exists:users,id'],
            'start_date'              => ['nullable', 'date'],
            'end_date'                => ['nullable', 'date'],
            'travel_required'         => ['nullable', 'boolean'],
            'delegates_count'         => ['nullable', 'integer', 'min:0'],
            'procurement_required'    => ['nullable', 'boolean'],
        ]);

        $programme = $this->service->update($programme, $data, $request->user());
        return response()->json(['message' => 'Programme updated.', 'data' => $programme]);
    }

    public function destroy(Programme $programme): JsonResponse
    {
        $this->service->delete($programme);
        return response()->json(['message' => 'Programme deleted.']);
    }

    public function submit(Request $request, Programme $programme): JsonResponse
    {
        $result = $this->service->submit($programme, $request->user());
        return response()->json(['message' => 'Programme submitted.', 'data' => $result]);
    }

    public function approve(Request $request, Programme $programme): JsonResponse
    {
        $result = $this->service->approve($programme, $request->user());
        return response()->json(['message' => 'Programme approved.', 'data' => $result]);
    }

    public function reject(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $result = $this->service->reject($programme, $data['reason'], $request->user());
        return response()->json(['message' => 'Programme rejected.', 'data' => $result]);
    }
}
