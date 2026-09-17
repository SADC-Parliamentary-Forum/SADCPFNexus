<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractException;
use App\Models\User;

/**
 * Central raising/resolution of contract exceptions (PRD §99 exception register,
 * §42/§54). Exceptions are visible records, not hidden log lines.
 */
class ContractExceptionService
{
    /**
     * Raise (or refresh) an exception of a given type for a contract. Idempotent
     * per (contract, type): an open exception of the same type is updated rather
     * than duplicated.
     */
    public function raise(Contract $contract, string $type, string $severity, string $title, ?string $description = null, ?User $raisedBy = null): ContractException
    {
        $existing = ContractException::where('tenant_id', $contract->tenant_id)
            ->where('contract_id', $contract->id)
            ->where('type', $type)
            ->where('status', 'open')
            ->first();

        if ($existing) {
            $existing->update(['severity' => $severity, 'title' => $title, 'description' => $description]);

            return $existing;
        }

        return ContractException::create([
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'type' => $type,
            'severity' => $severity,
            'title' => $title,
            'description' => $description,
            'status' => 'open',
            'raised_by' => $raisedBy?->id,
        ]);
    }

    /**
     * Raise a CRITICAL exception when services have commenced (or are due to
     * commence) before the contract is fully executed (PRD §54, AT §121).
     * Nexus must not normalise retrospective contracting.
     */
    public function detectStartBeforeExecution(Contract $contract): ?ContractException
    {
        $start = $contract->service_start_date ?? $contract->start_date;
        $executed = in_array($contract->lifecycle(), ['FULLY_EXECUTED', 'ACTIVE', 'COMPLETED', 'CLOSING', 'CLOSED'], true);

        if ($start !== null && $start->lte(now()) && ! $executed) {
            return $this->raise(
                $contract,
                'service_started_before_execution',
                'critical',
                'Services commenced / due to commence before contract execution',
                'The service start date has been reached but the contract is not fully executed. Record an authorised exception and corrective action.',
            );
        }

        return null;
    }

    public function resolve(ContractException $exception, User $actor, ?string $resolution = null): ContractException
    {
        $exception->update([
            'status' => 'resolved',
            'authorised_by' => $actor->id,
            'authorised_at' => now(),
            'resolution' => $resolution,
        ]);

        return $exception;
    }
}
