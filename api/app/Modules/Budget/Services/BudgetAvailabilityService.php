<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetActualTransaction;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use Illuminate\Support\Facades\DB;

class BudgetAvailabilityService
{
    /**
     * @return array{
     *   budget_line_id:int,
     *   approved:float,
     *   actual:float,
     *   commitments:float,
     *   available:float,
     *   requested:?float,
     *   sufficient:bool,
     *   warnings:array<int,string>
     * }
     */
    public function check(int $budgetLineId, ?float $requested = null, bool $lock = false): array
    {
        $line = $lock
            ? BudgetLine::query()->whereKey($budgetLineId)->lockForUpdate()->firstOrFail()
            : BudgetLine::query()->findOrFail($budgetLineId);

        $approved = $line->currentApprovedAllocation();
        $actual = $this->sumActuals($line->id);
        $commitments = $this->sumActiveCommitments($line->id);
        $available = round($approved - $actual - $commitments, 2);

        $warnings = [];
        if ($available < 0) {
            $warnings[] = 'overcommitted';
        }
        if ($approved > 0) {
            $utilisation = (($approved - $available) / $approved) * 100;
            if ($utilisation >= 90) {
                $warnings[] = 'utilisation_90';
            } elseif ($utilisation >= 80) {
                $warnings[] = 'utilisation_80';
            } elseif ($utilisation >= 70) {
                $warnings[] = 'utilisation_70';
            }
        }

        $sufficient = $requested === null ? $available >= 0 : $available + 1e-9 >= $requested;
        if ($requested !== null && ! $sufficient) {
            $warnings[] = 'insufficient_funds';
        }

        return [
            'budget_line_id' => $line->id,
            'approved' => round($approved, 2),
            'actual' => round($actual, 2),
            'commitments' => round($commitments, 2),
            'available' => $available,
            'requested' => $requested,
            'sufficient' => $sufficient,
            'warnings' => array_values(array_unique($warnings)),
        ];
    }

    public function sumActuals(int $budgetLineId): float
    {
        return (float) BudgetActualTransaction::query()
            ->where('budget_line_id', $budgetLineId)
            ->sum(DB::raw('COALESCE(base_currency_amount, amount)'));
    }

    public function sumActiveCommitments(int $budgetLineId): float
    {
        return (float) BudgetReservation::query()
            ->where('budget_line_id', $budgetLineId)
            ->whereNull('released_at')
            ->whereIn('status', BudgetReservation::ACTIVE_STATUSES)
            ->sum('current_amount');
    }

    public function syncLegacySpent(BudgetLine $line): void
    {
        $actual = $this->sumActuals($line->id);
        $line->update(['amount_spent' => $actual]);
    }
}
