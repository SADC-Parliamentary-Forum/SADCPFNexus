<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetInsuranceClaim;
use App\Models\AssetInsurancePolicy;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class AssetInsuranceService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, AssetInsurancePolicy>
     */
    public function listPolicies(int $tenantId, array $filters = []): Collection
    {
        return AssetInsurancePolicy::query()
            ->with(['asset:id,asset_code,name', 'claims'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['asset_id']), fn ($q) => $q->where('asset_id', (int) $filters['asset_id']))
            ->orderByDesc('effective_to')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createPolicy(int $tenantId, array $data, User $user): AssetInsurancePolicy
    {
        if (! empty($data['asset_id'])) {
            $this->assertAsset($tenantId, (int) $data['asset_id']);
        }

        return AssetInsurancePolicy::create([
            'tenant_id' => $tenantId,
            'policy_number' => $data['policy_number'],
            'insurer_name' => $data['insurer_name'],
            'coverage_type' => $data['coverage_type'] ?? 'all_risk',
            'effective_from' => $data['effective_from'],
            'effective_to' => $data['effective_to'],
            'sum_insured' => $data['sum_insured'] ?? null,
            'premium_amount' => $data['premium_amount'] ?? null,
            'currency' => strtoupper($data['currency'] ?? 'NAD'),
            'status' => $data['status'] ?? 'active',
            'asset_id' => $data['asset_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ])->load(['asset:id,asset_code,name', 'claims']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updatePolicy(AssetInsurancePolicy $policy, array $data): AssetInsurancePolicy
    {
        if (array_key_exists('asset_id', $data) && $data['asset_id']) {
            $this->assertAsset((int) $policy->tenant_id, (int) $data['asset_id']);
        }
        $policy->fill(collect($data)->only([
            'policy_number', 'insurer_name', 'coverage_type', 'effective_from', 'effective_to',
            'sum_insured', 'premium_amount', 'currency', 'status', 'asset_id', 'notes',
        ])->all());
        if (isset($data['currency'])) {
            $policy->currency = strtoupper((string) $data['currency']);
        }
        $policy->save();

        return $policy->fresh(['asset:id,asset_code,name', 'claims']);
    }

    /**
     * Renew creates a successor policy and marks the current one expired.
     *
     * @param  array<string, mixed>  $data
     */
    public function renewPolicy(AssetInsurancePolicy $policy, array $data, User $user): AssetInsurancePolicy
    {
        $from = $data['effective_from'] ?? optional($policy->effective_to)->copy()->addDay()->toDateString();
        $to = $data['effective_to'] ?? null;
        if (! $to) {
            throw ValidationException::withMessages(['effective_to' => ['New effective_to is required for renewal.']]);
        }

        $renewed = AssetInsurancePolicy::create([
            'tenant_id' => $policy->tenant_id,
            'policy_number' => $data['policy_number'] ?? ($policy->policy_number.'-R'),
            'insurer_name' => $data['insurer_name'] ?? $policy->insurer_name,
            'coverage_type' => $data['coverage_type'] ?? $policy->coverage_type,
            'effective_from' => $from,
            'effective_to' => $to,
            'sum_insured' => $data['sum_insured'] ?? $policy->sum_insured,
            'premium_amount' => $data['premium_amount'] ?? $policy->premium_amount,
            'currency' => strtoupper($data['currency'] ?? $policy->currency ?? 'NAD'),
            'status' => 'active',
            'asset_id' => $data['asset_id'] ?? $policy->asset_id,
            'notes' => $data['notes'] ?? ('Renewed from policy #'.$policy->id),
            'created_by' => $user->id,
        ]);

        $policy->update(['status' => 'expired']);

        return $renewed->fresh(['asset:id,asset_code,name', 'claims']);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, AssetInsuranceClaim>
     */
    public function listClaims(int $tenantId, array $filters = []): Collection
    {
        return AssetInsuranceClaim::query()
            ->with(['policy:id,policy_number,insurer_name', 'asset:id,asset_code,name'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['policy_id']), fn ($q) => $q->where('policy_id', (int) $filters['policy_id']))
            ->orderByDesc('incident_date')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createClaim(int $tenantId, array $data, User $user): AssetInsuranceClaim
    {
        $policy = AssetInsurancePolicy::query()
            ->where('tenant_id', $tenantId)
            ->whereKey((int) $data['policy_id'])
            ->firstOrFail();

        if (! empty($data['asset_id'])) {
            $this->assertAsset($tenantId, (int) $data['asset_id']);
        }

        return AssetInsuranceClaim::create([
            'tenant_id' => $tenantId,
            'policy_id' => $policy->id,
            'asset_id' => $data['asset_id'] ?? $policy->asset_id,
            'claim_number' => $data['claim_number'],
            'incident_date' => $data['incident_date'],
            'filed_at' => $data['filed_at'] ?? null,
            'claim_amount' => $data['claim_amount'] ?? null,
            'settled_amount' => $data['settled_amount'] ?? null,
            'currency' => strtoupper($data['currency'] ?? $policy->currency ?? 'NAD'),
            'status' => $data['status'] ?? 'draft',
            'description' => $data['description'] ?? null,
            'outcome_notes' => $data['outcome_notes'] ?? null,
            'created_by' => $user->id,
        ])->load(['policy:id,policy_number,insurer_name', 'asset:id,asset_code,name']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateClaim(AssetInsuranceClaim $claim, array $data): AssetInsuranceClaim
    {
        $claim->fill(collect($data)->only([
            'asset_id', 'claim_number', 'incident_date', 'filed_at', 'claim_amount',
            'settled_amount', 'currency', 'status', 'description', 'outcome_notes',
        ])->all());
        if (isset($data['currency'])) {
            $claim->currency = strtoupper((string) $data['currency']);
        }
        $claim->save();

        return $claim->fresh(['policy:id,policy_number,insurer_name', 'asset:id,asset_code,name']);
    }

    private function assertAsset(int $tenantId, int $assetId): void
    {
        if (! Asset::where('tenant_id', $tenantId)->whereKey($assetId)->exists()) {
            throw ValidationException::withMessages(['asset_id' => ['Asset not found for this tenant.']]);
        }
    }
}
