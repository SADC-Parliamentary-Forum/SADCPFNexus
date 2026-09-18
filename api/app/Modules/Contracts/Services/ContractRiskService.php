<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Portfolio risk analytics for contracts (P2). Scores each contract from
 * signals already tracked in the system — expiry proximity, overdue
 * deliverables, open exceptions, stalled signatures, pending clause deviations,
 * approaching auto-renewal deadlines and financial exposure — then rolls the
 * scores into a portfolio-wide heatmap. Read-only and tenant/ownership scoped.
 */
class ContractRiskService
{
    /** Contracts still "live" enough for expiry / signature risk to matter. */
    private const LIVE_STATUSES = ['ACTIVE', 'FULLY_EXECUTED', 'APPROVED_FOR_SIGNATURE', 'SENT_FOR_SIGNATURE', 'PARTIALLY_SIGNED'];

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
    public function portfolio(User $user): array
    {
        $contracts = $this->scoped($user)
            ->with(['deliverables:id,contract_id,status,due_date', 'exceptions:id,contract_id,severity,status', 'clauseAssignments:id,contract_id,deviation_status', 'signatories:id,contract_id,status'])
            ->get();

        $assessed = $contracts->map(fn (Contract $c) => $this->assess($c))->filter(fn ($r) => $r['score'] > 0)->sortByDesc('score')->values();

        $levels = ['critical' => 0, 'high' => 0, 'medium' => 0, 'low' => 0];
        foreach ($contracts as $c) {
            $levels[$this->assess($c)['level']]++;
        }

        $factorTally = [];
        foreach ($assessed as $row) {
            foreach ($row['factors'] as $f) {
                $factorTally[$f['code']] = ($factorTally[$f['code']] ?? 0) + 1;
            }
        }
        arsort($factorTally);

        $atRiskValue = round((float) $assessed->whereIn('level', ['critical', 'high'])->sum('value'), 2);

        return [
            'generated_at' => now()->toIso8601String(),
            'totals' => [
                'contracts' => $contracts->count(),
                'at_risk' => $assessed->count(),
                'at_risk_value' => $atRiskValue,
            ],
            'levels' => $levels,
            'top_factors' => collect($factorTally)->map(fn ($count, $code) => [
                'code' => $code,
                'label' => $this->factorLabel($code),
                'count' => $count,
            ])->values()->all(),
            'contracts' => $assessed->take(100)->all(),
        ];
    }

    /**
     * @return array{id: int, reference_number: string|null, title: string, level: string, score: int, value: float, end_date: string|null, factors: list<array{code: string, label: string, weight: int}>}
     */
    public function assess(Contract $contract): array
    {
        $factors = [];
        $add = function (string $code, int $weight) use (&$factors): void {
            $factors[] = ['code' => $code, 'label' => $this->factorLabel($code), 'weight' => $weight];
        };

        $status = (string) $contract->contract_status;
        $isLive = in_array($status, self::LIVE_STATUSES, true);
        $end = $contract->end_date instanceof Carbon ? $contract->end_date : null;

        // Expiry proximity (only meaningful for live contracts).
        if ($isLive && $end !== null) {
            $days = Carbon::now()->startOfDay()->diffInDays($end->copy()->startOfDay(), false);
            if ($days < 0 && in_array($status, ['ACTIVE', 'FULLY_EXECUTED'], true)) {
                $add('expired_active', 45);
            } elseif ($days >= 0 && $days <= 30) {
                $add('expiring_30', 40);
            } elseif ($days <= 60) {
                $add('expiring_60', 20);
            } elseif ($days <= 90) {
                $add('expiring_90', 10);
            }
        }

        // Overdue deliverables.
        $overdue = $contract->deliverables->filter(function ($d) {
            $due = $d->due_date instanceof Carbon ? $d->due_date : null;

            return $due !== null && $due->isPast() && ! in_array((string) $d->status, ['accepted', 'completed'], true);
        })->count();
        if ($overdue > 0) {
            $add('overdue_deliverables', min(50, $overdue * 25));
        }

        // Open exceptions by severity.
        $open = $contract->exceptions->filter(fn ($e) => (string) $e->status !== 'resolved');
        $critical = $open->where('severity', 'critical')->count();
        $high = $open->where('severity', 'high')->count();
        if ($critical > 0) {
            $add('open_critical_exception', min(80, $critical * 40));
        }
        if ($high > 0) {
            $add('open_high_exception', min(50, $high * 25));
        }

        // Signature stalled past deadline.
        $sigDeadline = $contract->signature_deadline instanceof Carbon ? $contract->signature_deadline : null;
        $awaiting = in_array($status, ['SENT_FOR_SIGNATURE', 'PARTIALLY_SIGNED', 'APPROVED_FOR_SIGNATURE'], true);
        if ($awaiting && $sigDeadline !== null && $sigDeadline->isPast()) {
            $add('signature_overdue', 30);
        }

        // Pending clause deviations (unapproved risk).
        $pendingDeviations = $contract->clauseAssignments->where('deviation_status', 'pending')->count();
        if ($pendingDeviations > 0) {
            $add('pending_clause_deviation', min(30, $pendingDeviations * 15));
        }

        // Auto-renewal decision window approaching with no decision recorded.
        $decisionDate = $contract->renewal_decision_date instanceof Carbon ? $contract->renewal_decision_date : null;
        if ($contract->auto_renew && $decisionDate !== null && ! $decisionDate->isPast()) {
            $windowDays = Carbon::now()->startOfDay()->diffInDays($decisionDate->copy()->startOfDay(), false);
            if ($windowDays >= 0 && $windowDays <= 30) {
                $add('auto_renewal_deadline', 20);
            }
        }

        // Financial exposure.
        $value = (float) $contract->current_value;
        if ($value >= 500000) {
            $add('high_value', 20);
        } elseif ($value >= 100000) {
            $add('material_value', 10);
        }

        $score = min(100, array_sum(array_column($factors, 'weight')));

        return [
            'id' => (int) $contract->id,
            'reference_number' => $contract->reference_number,
            'title' => (string) $contract->title,
            'level' => $this->level($score),
            'score' => $score,
            'value' => round($value, 2),
            'end_date' => optional($end)->toDateString(),
            'factors' => $factors,
        ];
    }

    private function level(int $score): string
    {
        return match (true) {
            $score >= 70 => 'critical',
            $score >= 40 => 'high',
            $score >= 15 => 'medium',
            default => 'low',
        };
    }

    private function factorLabel(string $code): string
    {
        return [
            'expired_active' => 'Active but past end date',
            'expiring_30' => 'Expiring within 30 days',
            'expiring_60' => 'Expiring within 60 days',
            'expiring_90' => 'Expiring within 90 days',
            'overdue_deliverables' => 'Overdue deliverables',
            'open_critical_exception' => 'Open critical exception',
            'open_high_exception' => 'Open high exception',
            'signature_overdue' => 'Signature overdue',
            'pending_clause_deviation' => 'Pending clause deviation',
            'auto_renewal_deadline' => 'Auto-renewal deadline approaching',
            'high_value' => 'High financial exposure',
            'material_value' => 'Material financial exposure',
        ][$code] ?? $code;
    }
}
