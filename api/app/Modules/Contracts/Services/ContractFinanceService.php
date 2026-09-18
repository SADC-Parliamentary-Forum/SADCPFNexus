<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractPaymentSchedule;

/**
 * Contract financial ledger and payment controls (PRD §56–§59).
 */
class ContractFinanceService
{
    /**
     * @return array{original: float, current: float, ceiling: float, paid: float, approved_unpaid: float, remaining: float, currency: string}
     */
    public function ledger(Contract $contract): array
    {
        $contract->loadMissing('paymentSchedules');

        $current = (float) ($contract->current_value ?? $contract->value);
        $ceiling = (float) ($contract->ceiling_value ?? $current);
        $paid = (float) $contract->paymentSchedules->sum('amount_paid');
        $approvedUnpaid = (float) $contract->paymentSchedules
            ->where('status', 'eligible')->sum('amount');

        return [
            'original' => (float) ($contract->original_value ?? $current),
            'current' => $current,
            'ceiling' => $ceiling,
            'paid' => $paid,
            'approved_unpaid' => $approvedUnpaid,
            'remaining' => round($current - $paid, 2),
            'currency' => (string) $contract->currency,
        ];
    }

    /**
     * Evaluate whether a payment of the given amount is eligible against the
     * contract ceiling and (when linked) deliverable acceptance (PRD §59,
     * AT §123, §124).
     *
     * @return array{eligible: bool, reasons: list<string>, overrun: float}
     */
    public function checkPaymentEligibility(Contract $contract, float $amount, ?int $paymentScheduleId = null): array
    {
        $reasons = [];
        $ledger = $this->ledger($contract);

        // Ceiling control: cumulative payments must not exceed the ceiling
        // unless an approved amendment has raised it.
        $ceiling = $ledger['ceiling'] > 0 ? $ledger['ceiling'] : $ledger['current'];
        $projected = $ledger['paid'] + $amount;
        $overrun = round($projected - $ceiling, 2);
        if ($overrun > 0) {
            $reasons[] = sprintf('Payment would exceed the contract ceiling by %s %s.', $contract->currency, number_format($overrun, 2));
        }

        // Milestone control: a milestone that depends on a deliverable is not
        // payable until that deliverable is accepted.
        if ($paymentScheduleId !== null) {
            /** @var ContractPaymentSchedule|null $schedule */
            $schedule = $contract->paymentSchedules()->find($paymentScheduleId);
            if ($schedule && $schedule->trigger_deliverable_id) {
                $accepted = $contract->deliverables()
                    ->whereKey($schedule->trigger_deliverable_id)
                    ->where('status', 'accepted')
                    ->exists();
                if (! $accepted) {
                    $reasons[] = 'The linked deliverable has not been accepted.';
                }
            }
            if ($schedule && $schedule->status === 'paid') {
                $reasons[] = 'This milestone has already been paid.';
            }
        }

        // Expiry warning (non-blocking here; Finance is warned).
        if ($contract->end_date && $contract->end_date->isPast()) {
            $reasons[] = 'Warning: the contract term has ended.';
        }

        $eligible = $overrun <= 0
            && ! collect($reasons)->contains(fn ($r) => str_contains($r, 'not been accepted') || str_contains($r, 'already been paid'));

        return ['eligible' => $eligible, 'reasons' => $reasons, 'overrun' => max(0, $overrun)];
    }
}
