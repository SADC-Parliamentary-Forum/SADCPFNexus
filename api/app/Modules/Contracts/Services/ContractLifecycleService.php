<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractSuspension;
use App\Models\ContractTermination;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Contract suspension and termination (PRD §75–§77). Termination is never a
 * delete — it creates an audited child record and freezes the contract.
 */
class ContractLifecycleService
{
    public function suspend(Contract $contract, User $user, array $data): ContractSuspension
    {
        if ($contract->lifecycle() !== 'ACTIVE') {
            throw ValidationException::withMessages(['status' => ['Only active contracts can be suspended.']]);
        }

        return DB::transaction(function () use ($contract, $user, $data): ContractSuspension {
            $suspension = ContractSuspension::create([
                'tenant_id' => $contract->tenant_id,
                'contract_id' => $contract->id,
                'effective_date' => $data['effective_date'] ?? now()->toDateString(),
                'reason' => $data['reason'],
                'approving_authority_id' => $data['approving_authority_id'] ?? $user->id,
                'affected_obligations' => $data['affected_obligations'] ?? null,
                'payment_impact' => $data['payment_impact'] ?? null,
                'restart_conditions' => $data['restart_conditions'] ?? null,
                'resumption_date' => $data['resumption_date'] ?? null,
                'status' => 'active',
                'created_by' => $user->id,
            ]);

            $contract->update(['contract_status' => 'SUSPENDED']);

            return $suspension;
        });
    }

    public function resume(Contract $contract, User $user): Contract
    {
        if ($contract->lifecycle() !== 'SUSPENDED') {
            throw ValidationException::withMessages(['status' => ['Only suspended contracts can be resumed.']]);
        }

        return DB::transaction(function () use ($contract, $user): Contract {
            $contract->suspensions()->where('status', 'active')->update([
                'status' => 'lifted',
                'lifted_by' => $user->id,
                'lifted_at' => now(),
            ]);

            $contract->update(['contract_status' => 'ACTIVE']);

            return $contract->fresh(['suspensions']);
        });
    }

    public function terminate(Contract $contract, User $user, array $data): ContractTermination
    {
        if (in_array($contract->lifecycle(), ['CLOSED', 'TERMINATED', 'DRAFT'], true)) {
            throw ValidationException::withMessages(['status' => ['This contract cannot be terminated in its current state.']]);
        }

        return DB::transaction(function () use ($contract, $user, $data): ContractTermination {
            $termination = ContractTermination::create([
                'tenant_id' => $contract->tenant_id,
                'contract_id' => $contract->id,
                'type' => $data['type'],
                'reason' => $data['reason'],
                'notice_reference' => $data['notice_reference'] ?? null,
                'effective_date' => $data['effective_date'] ?? now()->toDateString(),
                'outstanding_obligations' => $data['outstanding_obligations'] ?? null,
                'final_amount' => $data['final_amount'] ?? null,
                'dispute_status' => $data['dispute_status'] ?? null,
                'approved_by' => $user->id,
                'created_by' => $user->id,
            ]);

            $contract->update([
                'contract_status' => 'TERMINATED',
                'status' => 'terminated',
                'terminated_at' => now(),
                'termination_reason' => $data['reason'],
            ]);

            return $termination;
        });
    }
}
