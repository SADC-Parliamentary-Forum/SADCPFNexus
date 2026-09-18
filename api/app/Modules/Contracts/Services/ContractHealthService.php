<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;

/**
 * Rules-based contract health (PRD §85). Objective conditions only — never an
 * AI/legal opinion. Returns normal | attention | critical with reasons.
 */
class ContractHealthService
{
    /**
     * @return array{status: string, reasons: list<string>}
     */
    public function evaluate(Contract $contract): array
    {
        $contract->loadMissing(['deliverables', 'exceptions', 'complianceDocuments', 'paymentSchedules']);
        $reasons = [];
        $critical = false;
        $attention = false;

        $lifecycle = $contract->lifecycle();
        $executed = in_array($lifecycle, ['FULLY_EXECUTED', 'ACTIVE', 'COMPLETED', 'CLOSING', 'CLOSED'], true);
        $start = $contract->service_start_date ?? $contract->start_date;

        // Critical: service started before execution.
        if ($start && $start->lte(now()) && ! $executed && ! in_array($lifecycle, ['CLOSED', 'TERMINATED', 'REJECTED', 'DECLINED'], true)) {
            $critical = true;
            $reasons[] = 'Services commenced before the contract was executed.';
        }

        // Critical: paid beyond the ceiling.
        $ceiling = (float) ($contract->ceiling_value ?? $contract->current_value);
        $paid = (float) $contract->paymentSchedules->sum('amount_paid');
        if ($ceiling > 0 && $paid > $ceiling + 0.01) {
            $critical = true;
            $reasons[] = 'Payments exceed the contract ceiling.';
        }

        // Critical: expired mandatory compliance during an active contract.
        foreach ($contract->complianceDocuments as $doc) {
            if ($doc->expiry_date && $doc->expiry_date->isPast() && $lifecycle === 'ACTIVE') {
                $critical = true;
                $reasons[] = 'A mandatory compliance document has expired.';
                break;
            }
        }

        // Critical: any open critical exception.
        if ($contract->exceptions->where('status', 'open')->where('severity', 'critical')->isNotEmpty()) {
            $critical = true;
            $reasons[] = 'An open critical exception exists.';
        }

        // Attention: expiry approaching.
        if ($contract->end_date && ! $contract->end_date->isPast() && $contract->end_date->diffInDays(now()) <= 30) {
            $attention = true;
            $reasons[] = 'Contract expires within 30 days.';
        }

        // Attention: overdue deliverable.
        foreach ($contract->deliverables as $d) {
            if ($d->due_date && $d->due_date->isPast() && ! in_array($d->status, ['accepted', 'waived'], true)) {
                $attention = true;
                $reasons[] = 'A deliverable is overdue.';
                break;
            }
        }

        $status = $critical ? 'critical' : ($attention ? 'attention' : 'normal');

        return ['status' => $status, 'reasons' => $reasons];
    }
}
