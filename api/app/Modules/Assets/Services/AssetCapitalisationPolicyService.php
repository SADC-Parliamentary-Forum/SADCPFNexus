<?php

namespace App\Modules\Assets\Services;

use App\Models\AssetCapitalisationPolicy;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AssetCapitalisationPolicyService
{
    /**
     * Resolve the active capitalisation policy for a tenant on a given date.
     */
    public function activePolicy(int $tenantId, ?Carbon $asOf = null): ?AssetCapitalisationPolicy
    {
        $asOf = $asOf ?? now();

        return AssetCapitalisationPolicy::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereDate('effective_from', '<=', $asOf->toDateString())
            ->where(function ($q) use ($asOf) {
                $q->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $asOf->toDateString());
            })
            ->orderByDesc('effective_from')
            ->first();
    }

    /**
     * Ensure a default policy exists (Accounting Manual USD 250 baseline).
     */
    public function ensureDefault(int $tenantId): AssetCapitalisationPolicy
    {
        $existing = $this->activePolicy($tenantId);
        if ($existing) {
            return $existing;
        }

        return AssetCapitalisationPolicy::create([
            'tenant_id' => $tenantId,
            'version' => 'v1',
            'effective_from' => '2020-01-01',
            'threshold_amount' => 250,
            'threshold_currency' => 'USD',
            'min_useful_life_years' => 1,
            'approved_by' => 'System Default',
            'source_document' => 'SADC PF Accounting Policies and Procedures Manual',
            'is_active' => true,
        ]);
    }

    /**
     * Classify an item as capital or controlled (never consumable — that is Stock).
     *
     * @return 'capital'|'controlled'
     */
    public function classify(
        float $unitCost,
        ?int $usefulLifeYears,
        AssetCapitalisationPolicy $policy,
        bool $forceControlled = false,
    ): string {
        if ($forceControlled) {
            return 'controlled';
        }

        $meetsLife = $usefulLifeYears === null || $usefulLifeYears >= (int) $policy->min_useful_life_years;
        if ($unitCost >= (float) $policy->threshold_amount && $meetsLife) {
            return 'capital';
        }

        // Below threshold but durable / custody-controlled → controlled non-capital
        return 'controlled';
    }

    public function createVersion(int $tenantId, array $data, ?string $deactivatePrevious = null): AssetCapitalisationPolicy
    {
        return DB::transaction(function () use ($tenantId, $data) {
            if (! empty($data['is_active'])) {
                AssetCapitalisationPolicy::where('tenant_id', $tenantId)
                    ->where('is_active', true)
                    ->update(['is_active' => false, 'effective_to' => now()->toDateString()]);
            }

            return AssetCapitalisationPolicy::create([
                'tenant_id' => $tenantId,
                'version' => $data['version'],
                'effective_from' => $data['effective_from'],
                'effective_to' => $data['effective_to'] ?? null,
                'threshold_amount' => $data['threshold_amount'],
                'threshold_currency' => $data['threshold_currency'] ?? 'USD',
                'min_useful_life_years' => $data['min_useful_life_years'] ?? 1,
                'categories_affected' => $data['categories_affected'] ?? null,
                'donor_specific_treatment' => $data['donor_specific_treatment'] ?? null,
                'approved_by' => $data['approved_by'] ?? null,
                'source_document' => $data['source_document'] ?? null,
                'is_active' => $data['is_active'] ?? true,
            ]);
        });
    }
}
