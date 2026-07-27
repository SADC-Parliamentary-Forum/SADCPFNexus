<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetDepreciationRatePolicy;
use App\Models\AssetDepreciationRun;
use App\Models\AssetDepreciationRunLine;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AssetDepreciationService
{
    public function ensureDefaultPolicy(int $tenantId): AssetDepreciationRatePolicy
    {
        $existing = AssetDepreciationRatePolicy::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderByDesc('effective_from')
            ->first();
        if ($existing) {
            return $existing;
        }

        // Accounting Manual straight-line defaults (years)
        return AssetDepreciationRatePolicy::create([
            'tenant_id' => $tenantId,
            'version' => 'v1',
            'effective_from' => '2020-01-01',
            'method' => 'straight_line',
            'category_rates' => [
                'it' => ['years' => 3, 'rate_pct' => 33.33],
                'equipment' => ['years' => 5, 'rate_pct' => 20],
                'furniture' => ['years' => 10, 'rate_pct' => 10],
                'fleet' => ['years' => 5, 'rate_pct' => 20],
                'vehicles' => ['years' => 5, 'rate_pct' => 20],
            ],
            'approved_by' => 'System Default',
            'is_active' => true,
        ]);
    }

    /**
     * Run depreciation for capital assets for monitoring/reports (not official GL).
     */
    public function run(int $tenantId, User $user, ?Carbon $asOf = null): AssetDepreciationRun
    {
        $asOf = $asOf ?? now();
        $policy = $this->ensureDefaultPolicy($tenantId);

        return DB::transaction(function () use ($tenantId, $user, $asOf, $policy) {
            $run = AssetDepreciationRun::create([
                'tenant_id' => $tenantId,
                'policy_id' => $policy->id,
                'run_date' => $asOf->toDateString(),
                'period_start' => $asOf->copy()->startOfMonth()->toDateString(),
                'period_end' => $asOf->copy()->endOfMonth()->toDateString(),
                'status' => 'completed',
                'run_by' => $user->id,
            ]);

            $assets = Asset::where('tenant_id', $tenantId)
                ->where('asset_class', 'capital')
                ->whereNotIn('status', ['pending', 'disposed', 'sold', 'written_off', 'scrapped', 'donated_out', 'retired'])
                ->whereNotNull('purchase_value')
                ->whereNotNull('purchase_date')
                ->get();

            $total = 0.0;
            foreach ($assets as $asset) {
                $years = $asset->useful_life_years;
                if (! $years) {
                    $cat = strtolower((string) $asset->category);
                    $years = (int) ($policy->category_rates[$cat]['years'] ?? 5);
                }
                $salvage = (float) ($asset->salvage_value ?? 0);
                $purchase = (float) $asset->purchase_value;
                $annual = $years > 0 ? ($purchase - $salvage) / $years : 0;
                // Monthly slice for this run
                $amount = round($annual / 12, 2);
                $opening = $asset->book_value !== null ? (float) $asset->book_value : $purchase;
                $closing = max($salvage, round($opening - $amount, 2));
                $actual = round($opening - $closing, 2);
                $accum = ($asset->accumulated_depreciation !== null ? (float) $asset->accumulated_depreciation : 0) + $actual;

                AssetDepreciationRunLine::create([
                    'run_id' => $run->id,
                    'asset_id' => $asset->id,
                    'opening_book_value' => $opening,
                    'depreciation_amount' => $actual,
                    'closing_book_value' => $closing,
                    'accumulated_depreciation' => $accum,
                ]);

                $asset->book_value = $closing;
                $asset->accumulated_depreciation = $accum;
                $asset->value = $closing;
                $asset->save();

                $total += $actual;
            }

            $run->asset_count = $assets->count();
            $run->total_depreciation = $total;
            $run->save();

            AuditLog::record('assets.depreciation_run', [
                'auditable_type' => AssetDepreciationRun::class,
                'auditable_id' => $run->id,
                'new_values' => [
                    'asset_count' => $run->asset_count,
                    'total_depreciation' => $total,
                    'note' => 'Monitoring only — official GL remains accounting system',
                ],
                'tags' => 'assets',
            ]);

            return $run->fresh(['lines']);
        });
    }
}
