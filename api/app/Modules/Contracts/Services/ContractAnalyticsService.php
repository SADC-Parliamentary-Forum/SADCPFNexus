<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractAmendment;
use App\Models\ContractDeliverable;
use App\Models\User;
use App\Models\VendorPerformanceEvaluation;
use Illuminate\Database\Eloquent\Builder;

/**
 * Management analytics for the contract portfolio (PRD §101). Aggregates over
 * existing data — value by department/type, creation trend, expiry forecast,
 * amendment frequency, execution turnaround, on-time deliverables and supplier
 * performance.
 */
class ContractAnalyticsService
{
    public function __construct(private readonly ContractService $contracts) {}

    private function scoped(User $user): Builder
    {
        $q = Contract::query()->where('tenant_id', $user->tenant_id);
        if (! $this->contracts->canViewAll($user)) {
            $q->where('created_by', $user->id);
        }

        return $q;
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(User $user): array
    {
        $contracts = $this->scoped($user)->with(['department', 'type'])->get();

        return [
            'totals' => [
                'contracts' => $contracts->count(),
                'active' => $contracts->where('contract_status', 'ACTIVE')->count(),
                'current_value' => round((float) $contracts->sum(fn ($c) => (float) $c->current_value), 2),
            ],
            'value_by_department' => $this->groupValue($contracts, fn ($c) => optional($c->department)->name ?? 'Unassigned'),
            'value_by_type' => $this->groupValue($contracts, fn ($c) => optional($c->type)->name ?? 'Unclassified'),
            'value_by_donor' => $this->groupValue($contracts, fn ($c) => $c->donor ?: 'None'),
            'monthly_creation' => $this->monthlyCreation($contracts),
            'expiry_forecast' => $this->expiryForecast($contracts),
            'amendment_frequency' => $this->amendmentFrequency($user, $contracts),
            'avg_execution_turnaround_days' => $this->avgExecutionTurnaround($contracts),
            'on_time_deliverable_rate' => $this->onTimeDeliverableRate($user),
            'supplier_performance' => $this->supplierPerformance($user),
        ];
    }

    /**
     * @return list<array{label: string, count: int, value: float}>
     */
    private function groupValue($contracts, callable $key): array
    {
        return $contracts->groupBy($key)->map(fn ($group, $label) => [
            'label' => (string) $label,
            'count' => $group->count(),
            'value' => round((float) $group->sum(fn ($c) => (float) $c->current_value), 2),
        ])->sortByDesc('value')->values()->all();
    }

    /**
     * @return list<array{month: string, count: int}>
     */
    private function monthlyCreation($contracts): array
    {
        $months = collect(range(0, 11))->map(fn ($i) => now()->subMonths($i)->format('Y-m'))->reverse()->values();
        $byMonth = $contracts->groupBy(fn ($c) => optional($c->created_at)->format('Y-m'));

        return $months->map(fn ($m) => ['month' => $m, 'count' => $byMonth->get($m)?->count() ?? 0])->all();
    }

    /**
     * @return list<array{bucket: string, count: int, value: float}>
     */
    private function expiryForecast($contracts): array
    {
        $active = $contracts->whereIn('contract_status', ['ACTIVE', 'FULLY_EXECUTED']);
        $buckets = ['0-30' => [0, 30], '31-60' => [31, 60], '61-90' => [61, 90], '91-120' => [91, 120]];
        $out = [];
        foreach ($buckets as $label => [$from, $to]) {
            $in = $active->filter(function ($c) use ($from, $to) {
                if ($c->end_date === null || $c->end_date->isPast()) {
                    return false;
                }
                $days = now()->diffInDays($c->end_date, false);

                return $days >= $from && $days <= $to;
            });
            $out[] = ['bucket' => $label.' days', 'count' => $in->count(), 'value' => round((float) $in->sum(fn ($c) => (float) $c->current_value), 2)];
        }

        return $out;
    }

    /**
     * @return array{total_contracts: int, contracts_with_amendments: int, total_amendments: int, avg_per_contract: float}
     */
    private function amendmentFrequency(User $user, $contracts): array
    {
        $ids = $contracts->pluck('id');
        $amendments = ContractAmendment::where('tenant_id', $user->tenant_id)->whereIn('contract_id', $ids)->get(['contract_id']);
        $total = $contracts->count();

        return [
            'total_contracts' => $total,
            'contracts_with_amendments' => $amendments->pluck('contract_id')->unique()->count(),
            'total_amendments' => $amendments->count(),
            'avg_per_contract' => $total > 0 ? round($amendments->count() / $total, 2) : 0.0,
        ];
    }

    private function avgExecutionTurnaround($contracts): ?float
    {
        $executed = $contracts->filter(fn ($c) => $c->signed_at !== null && $c->created_at !== null);
        if ($executed->isEmpty()) {
            return null;
        }

        return round($executed->avg(fn ($c) => $c->created_at->diffInDays($c->signed_at)), 1);
    }

    /**
     * @return array{accepted: int, on_time: int, rate: float}
     */
    private function onTimeDeliverableRate(User $user): array
    {
        $ids = $this->scoped($user)->pluck('id');
        $accepted = ContractDeliverable::where('tenant_id', $user->tenant_id)
            ->whereIn('contract_id', $ids)
            ->where('status', 'accepted')
            ->get(['due_date', 'accepted_at']);

        $onTime = $accepted->filter(fn ($d) => $d->due_date !== null && $d->accepted_at !== null && $d->accepted_at->lte($d->due_date->endOfDay()))->count();

        return [
            'accepted' => $accepted->count(),
            'on_time' => $onTime,
            'rate' => $accepted->count() > 0 ? round(($onTime / $accepted->count()) * 100, 1) : 0.0,
        ];
    }

    /**
     * @return array{evaluations: int, average_overall: float|null}
     */
    private function supplierPerformance(User $user): array
    {
        $evals = VendorPerformanceEvaluation::where('tenant_id', $user->tenant_id)->get();

        return [
            'evaluations' => $evals->count(),
            'average_overall' => $evals->isNotEmpty() ? round($evals->avg(fn ($e) => $e->overall_score), 2) : null,
        ];
    }
}
