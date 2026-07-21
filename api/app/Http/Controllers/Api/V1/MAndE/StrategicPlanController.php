<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Http\Requests\MAndE\StoreStrategicPlanRequest;
use App\Http\Requests\MAndE\UpdateStrategicPlanRequest;
use App\Models\StrategicGoal;
use App\Models\StrategicObjective;
use App\Models\StrategicOutcome;
use App\Models\StrategicPlan;
use App\Modules\MAndE\Services\StrategicPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StrategicPlanController extends Controller
{
    public function __construct(private readonly StrategicPlanService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'per_page']);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function show(Request $request, StrategicPlan $strategicPlan): JsonResponse
    {
        $this->ensureTenant($request, $strategicPlan);
        return response()->json(['data' => $this->service->get($strategicPlan)]);
    }

    public function store(StoreStrategicPlanRequest $request): JsonResponse
    {
        $plan = $this->service->create($request->validated(), $request->user());
        return response()->json(['message' => 'Strategic plan created.', 'data' => $plan], 201);
    }

    public function update(UpdateStrategicPlanRequest $request, StrategicPlan $strategicPlan): JsonResponse
    {
        $this->ensureTenant($request, $strategicPlan);
        $plan = $this->service->update($strategicPlan, $request->validated(), $request->user());
        return response()->json(['message' => 'Strategic plan updated.', 'data' => $plan]);
    }

    public function archive(Request $request, StrategicPlan $strategicPlan): JsonResponse
    {
        $this->ensureTenant($request, $strategicPlan);
        $plan = $this->service->archive($strategicPlan, $request->user());
        return response()->json(['message' => 'Strategic plan archived.', 'data' => $plan]);
    }

    public function activate(Request $request, StrategicPlan $strategicPlan): JsonResponse
    {
        $this->ensureTenant($request, $strategicPlan);
        $plan = $this->service->activate($strategicPlan, $request->user());
        return response()->json(['message' => 'Strategic plan activated.', 'data' => $plan]);
    }

    public function destroy(Request $request, StrategicPlan $strategicPlan): JsonResponse
    {
        $this->ensureTenant($request, $strategicPlan);
        $this->service->delete($strategicPlan, $request->user());
        return response()->json(['message' => 'Strategic plan deleted.']);
    }

    // ── Nested configuration ──────────────────────────────────────────────────

    public function addGoal(Request $request, StrategicPlan $strategicPlan): JsonResponse
    {
        $this->ensureTenant($request, $strategicPlan);
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:300'],
            'code'        => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order'  => ['nullable', 'integer'],
        ]);
        $goal = $this->service->addGoal($strategicPlan, $data, $request->user());
        return response()->json(['message' => 'Goal added.', 'data' => $goal], 201);
    }

    public function addObjective(Request $request, StrategicGoal $goal): JsonResponse
    {
        $this->ensureTenantModel($request, $goal);
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:300'],
            'code'        => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order'  => ['nullable', 'integer'],
        ]);
        $objective = $this->service->addObjective($goal, $data);
        return response()->json(['message' => 'Objective added.', 'data' => $objective], 201);
    }

    public function addOutcome(Request $request, StrategicObjective $objective): JsonResponse
    {
        $this->ensureTenantModel($request, $objective);
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:300'],
            'code'        => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order'  => ['nullable', 'integer'],
        ]);
        $outcome = $this->service->addOutcome($objective, $data);
        return response()->json(['message' => 'Outcome added.', 'data' => $outcome], 201);
    }

    public function addOutput(Request $request, StrategicOutcome $outcome): JsonResponse
    {
        $this->ensureTenantModel($request, $outcome);
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:300'],
            'code'        => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sort_order'  => ['nullable', 'integer'],
        ]);
        $output = $this->service->addOutput($outcome, $data);
        return response()->json(['message' => 'Output added.', 'data' => $output], 201);
    }

    public function deleteNode(Request $request, string $type, int $id): JsonResponse
    {
        $this->service->deleteNode($type, $id, $request->user());
        return response()->json(['message' => ucfirst($type) . ' removed.']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function ensureTenant(Request $request, StrategicPlan $plan): void
    {
        if ((int) $plan->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }

    private function ensureTenantModel(Request $request, $model): void
    {
        if ((int) $model->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
