<?php

namespace App\Modules\Contracts\Services;

use App\Models\ContractKeyPersonnel;
use App\Models\ContractPersonnelReplacement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Key personnel & replacement approval (PRD §80). Approving a replacement marks
 * the outgoing person 'replaced' and creates the successor as a new personnel
 * record, preserving history.
 */
class ContractKeyPersonnelService
{
    public function approveReplacement(ContractPersonnelReplacement $replacement, User $approver, ?string $note = null): ContractKeyPersonnel
    {
        if ($replacement->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This replacement request is not pending.']]);
        }

        return DB::transaction(function () use ($replacement, $approver, $note) {
            $outgoing = $replacement->personnel;

            $successor = ContractKeyPersonnel::create([
                'tenant_id' => $replacement->tenant_id,
                'contract_id' => $replacement->contract_id,
                'name' => $replacement->proposed_name,
                'role' => $replacement->proposed_role,
                'email' => $replacement->proposed_email,
                'cv_reference' => $replacement->proposed_cv_reference,
                'is_key' => $outgoing?->is_key ?? true,
                'status' => 'active',
                'created_by' => $approver->id,
            ]);

            $outgoing?->update(['status' => 'replaced', 'replaced_by_id' => $successor->id]);

            $replacement->update([
                'status' => 'approved',
                'decided_by' => $approver->id,
                'decided_at' => now(),
                'decision_note' => $note,
            ]);

            return $successor;
        });
    }

    public function rejectReplacement(ContractPersonnelReplacement $replacement, User $approver, ?string $note = null): void
    {
        if ($replacement->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This replacement request is not pending.']]);
        }

        $replacement->update([
            'status' => 'rejected',
            'decided_by' => $approver->id,
            'decided_at' => now(),
            'decision_note' => $note,
        ]);
    }
}
