<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetInsuranceClaim;
use App\Models\AssetInsurancePolicy;
use App\Modules\Assets\Services\AssetInsuranceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AssetInsuranceController extends Controller
{
    public function __construct(private readonly AssetInsuranceService $insurance) {}

    public function indexPolicies(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(AssetInsurancePolicy::STATUSES)],
            'asset_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->insurance->listPolicies((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'policy_number' => ['required', 'string', 'max:120'],
            'insurer_name' => ['required', 'string', 'max:255'],
            'coverage_type' => ['nullable', 'string', 'max:64'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['required', 'date', 'after_or_equal:effective_from'],
            'sum_insured' => ['nullable', 'numeric', 'min:0'],
            'premium_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => ['nullable', Rule::in(AssetInsurancePolicy::STATUSES)],
            'asset_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
        ]);

        $policy = $this->insurance->createPolicy((int) $request->user()->tenant_id, $data, $request->user());

        return response()->json(['success' => true, 'data' => $policy], 201);
    }

    public function updatePolicy(Request $request, AssetInsurancePolicy $policy): JsonResponse
    {
        $this->assertTenant($request, (int) $policy->tenant_id);
        $data = $request->validate([
            'policy_number' => ['sometimes', 'string', 'max:120'],
            'insurer_name' => ['sometimes', 'string', 'max:255'],
            'coverage_type' => ['nullable', 'string', 'max:64'],
            'effective_from' => ['sometimes', 'date'],
            'effective_to' => ['sometimes', 'date'],
            'sum_insured' => ['nullable', 'numeric', 'min:0'],
            'premium_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(AssetInsurancePolicy::STATUSES)],
            'asset_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->insurance->updatePolicy($policy, $data),
        ]);
    }

    public function renewPolicy(Request $request, AssetInsurancePolicy $policy): JsonResponse
    {
        $this->assertTenant($request, (int) $policy->tenant_id);
        $data = $request->validate([
            'policy_number' => ['nullable', 'string', 'max:120'],
            'insurer_name' => ['nullable', 'string', 'max:255'],
            'coverage_type' => ['nullable', 'string', 'max:64'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['required', 'date'],
            'sum_insured' => ['nullable', 'numeric', 'min:0'],
            'premium_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'asset_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->insurance->renewPolicy($policy, $data, $request->user()),
        ]);
    }

    public function indexClaims(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(AssetInsuranceClaim::STATUSES)],
            'policy_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->insurance->listClaims((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function storeClaim(Request $request): JsonResponse
    {
        $data = $request->validate([
            'policy_id' => ['required', 'integer'],
            'asset_id' => ['nullable', 'integer'],
            'claim_number' => ['required', 'string', 'max:120'],
            'incident_date' => ['required', 'date'],
            'filed_at' => ['nullable', 'date'],
            'claim_amount' => ['nullable', 'numeric', 'min:0'],
            'settled_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => ['nullable', Rule::in(AssetInsuranceClaim::STATUSES)],
            'description' => ['nullable', 'string'],
            'outcome_notes' => ['nullable', 'string'],
        ]);

        $claim = $this->insurance->createClaim((int) $request->user()->tenant_id, $data, $request->user());

        return response()->json(['success' => true, 'data' => $claim], 201);
    }

    public function updateClaim(Request $request, AssetInsuranceClaim $claim): JsonResponse
    {
        $this->assertTenant($request, (int) $claim->tenant_id);
        $data = $request->validate([
            'asset_id' => ['nullable', 'integer'],
            'claim_number' => ['sometimes', 'string', 'max:120'],
            'incident_date' => ['sometimes', 'date'],
            'filed_at' => ['nullable', 'date'],
            'claim_amount' => ['nullable', 'numeric', 'min:0'],
            'settled_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'status' => ['sometimes', Rule::in(AssetInsuranceClaim::STATUSES)],
            'description' => ['nullable', 'string'],
            'outcome_notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->insurance->updateClaim($claim, $data),
        ]);
    }

    private function assertTenant(Request $request, int $tenantId): void
    {
        if ($tenantId !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
