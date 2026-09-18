<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractExtension;
use App\Models\ContractRenewal;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Extensions and renewals (PRD §72–§74).
 *
 * Extension = duration change only. Renewal = a new period under a contractual
 * right, tracked separately and gated on procurement + budget confirmation.
 */
class ContractRenewalService
{
    public function createExtension(Contract $contract, User $user, array $data): ContractExtension
    {
        if (! in_array($contract->lifecycle(), ['ACTIVE', 'FULLY_EXECUTED'], true)) {
            throw ValidationException::withMessages(['status' => ['Only executed/active contracts can be extended.']]);
        }

        $proposed = \Illuminate\Support\Carbon::parse($data['proposed_end_date']);
        if ($contract->end_date && $proposed->lte($contract->end_date)) {
            throw ValidationException::withMessages(['proposed_end_date' => ['The proposed end date must be after the current end date. Scope/value changes require an amendment, not an extension.']]);
        }

        return ContractExtension::create([
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'current_end_date' => $contract->end_date,
            'proposed_end_date' => $data['proposed_end_date'],
            'reason' => $data['reason'],
            'impact' => $data['impact'] ?? null,
            'financial_impact' => $data['financial_impact'] ?? null,
            'status' => 'pending',
            'created_by' => $user->id,
        ]);
    }

    public function approveExtension(Contract $contract, ContractExtension $extension, User $user): Contract
    {
        if ($extension->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This extension is not pending approval.']]);
        }

        $extension->update(['status' => 'approved', 'approved_by' => $user->id, 'approved_at' => now()]);
        $contract->update(['end_date' => $extension->proposed_end_date, 'service_end_date' => $extension->proposed_end_date]);

        return $contract->fresh(['extensions']);
    }

    public function createRenewal(Contract $contract, User $user, array $data): ContractRenewal
    {
        $type = $contract->renewal_type ?? 'subject_to_approval';
        if ($type === 'non_renewable') {
            throw ValidationException::withMessages(['renewal' => ['This contract is marked non-renewable.']]);
        }
        if ($type === 'renewable_once' && (int) $contract->renewals_count >= 1) {
            throw ValidationException::withMessages(['renewal' => ['This contract may only be renewed once and has already been renewed.']]);
        }

        return ContractRenewal::create([
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'renewal_number' => (int) $contract->renewals_count + 1,
            'new_start_date' => $data['new_start_date'],
            'new_end_date' => $data['new_end_date'],
            'reason' => $data['reason'] ?? null,
            'procurement_validated' => (bool) ($data['procurement_validated'] ?? false),
            'budget_confirmed' => (bool) ($data['budget_confirmed'] ?? false),
            'status' => 'pending',
            'created_by' => $user->id,
        ]);
    }

    public function approveRenewal(Contract $contract, ContractRenewal $renewal, User $user): Contract
    {
        if ($renewal->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This renewal is not pending approval.']]);
        }
        if (! $renewal->procurement_validated || ! $renewal->budget_confirmed) {
            throw ValidationException::withMessages(['renewal' => ['Procurement validation and budget confirmation are required before a renewal can be approved.']]);
        }

        $renewal->update(['status' => 'approved', 'approved_by' => $user->id, 'approved_at' => now()]);
        $contract->update([
            'start_date' => $renewal->new_start_date,
            'end_date' => $renewal->new_end_date,
            'service_start_date' => $renewal->new_start_date,
            'service_end_date' => $renewal->new_end_date,
            'renewals_count' => (int) $contract->renewals_count + 1,
            'contract_status' => 'ACTIVE',
            'status' => 'active',
        ]);

        return $contract->fresh(['renewals']);
    }
}
