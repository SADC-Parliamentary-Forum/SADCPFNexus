<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\AnnualProcurementPlan;
use App\Models\AnnualProcurementPlanItem;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AnnualProcurementPlanController extends Controller
{
    private function gate(Request $request): void
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin'])) {
            abort(403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->gate($request);
        $rows = AnnualProcurementPlan::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->withCount('items')
            ->orderByDesc('plan_year')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gate($request);
        $data = $request->validate([
            'plan_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'title'     => ['required', 'string', 'max:255'],
            'notes'     => ['nullable', 'string'],
            'items'     => ['nullable', 'array'],
            'items.*.description'      => ['required_with:items', 'string', 'max:500'],
            'items.*.estimated_value'  => ['nullable', 'numeric', 'min:0'],
            'items.*.suggested_method' => ['nullable', 'string', 'max:40'],
            'items.*.quarter'          => ['nullable', 'integer', 'min:1', 'max:4'],
            'items.*.category'         => ['nullable', 'string', 'max:64'],
        ]);

        if (AnnualProcurementPlan::where('tenant_id', $request->user()->tenant_id)->where('plan_year', $data['plan_year'])->exists()) {
            throw ValidationException::withMessages([
                'plan_year' => 'A procurement plan already exists for this year.',
            ]);
        }

        $plan = DB::transaction(function () use ($data, $request) {
            $plan = AnnualProcurementPlan::create([
                'tenant_id'  => $request->user()->tenant_id,
                'plan_year'  => $data['plan_year'],
                'title'      => $data['title'],
                'notes'      => $data['notes'] ?? null,
                'status'     => 'draft',
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['items'] ?? [] as $item) {
                $plan->items()->create([
                    'description'      => $item['description'],
                    'estimated_value'  => $item['estimated_value'] ?? 0,
                    'suggested_method' => $item['suggested_method'] ?? null,
                    'quarter'          => $item['quarter'] ?? null,
                    'category'         => $item['category'] ?? null,
                    'status'           => 'planned',
                ]);
            }

            return $plan;
        });

        AuditLog::record('procurement.plan_created', [
            'auditable_type' => AnnualProcurementPlan::class,
            'auditable_id'   => $plan->id,
            'tags'           => ['procurement', 'planning'],
        ]);

        return response()->json(['message' => 'Plan created.', 'data' => $plan->fresh('items')], 201);
    }

    public function show(Request $request, AnnualProcurementPlan $plan): JsonResponse
    {
        $this->gate($request);
        if ((int) $plan->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json(['data' => $plan->load('items')]);
    }

    public function storeItem(Request $request, AnnualProcurementPlan $plan): JsonResponse
    {
        $this->gate($request);
        if ((int) $plan->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'description'      => ['required', 'string', 'max:500'],
            'estimated_value'  => ['nullable', 'numeric', 'min:0'],
            'suggested_method' => ['nullable', 'string', 'max:40'],
            'quarter'          => ['nullable', 'integer', 'min:1', 'max:4'],
            'category'         => ['nullable', 'string', 'max:64'],
            'notes'            => ['nullable', 'string'],
        ]);

        $item = $plan->items()->create(array_merge($data, [
            'estimated_value' => $data['estimated_value'] ?? 0,
            'status'          => 'planned',
        ]));

        return response()->json(['message' => 'Plan item added.', 'data' => $item], 201);
    }

    public function destroy(Request $request, AnnualProcurementPlan $plan): JsonResponse
    {
        $this->gate($request);
        if ((int) $plan->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $plan->delete();

        return response()->json(['message' => 'Plan deleted.']);
    }
}
