<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractClause;
use App\Models\ContractClauseAssignment;
use App\Models\ContractClauseVersion;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Clause library management and assignment (PRD §30–§33). Clause versions are
 * pinned to the contract at assignment time; mandatory-locked clauses cannot be
 * deviated or removed; edits to standard clause text are recorded as deviations.
 */
class ContractClauseService
{
    public function createClause(User $user, array $data): ContractClause
    {
        $clause = ContractClause::create([
            'tenant_id' => $user->tenant_id,
            'key' => $data['key'],
            'title' => $data['title'],
            'category' => $data['category'] ?? null,
            'clause_type' => $data['clause_type'] ?? 'optional',
            'donor' => $data['donor'] ?? null,
            'condition_note' => $data['condition_note'] ?? null,
            'is_active' => true,
            'sort_order' => $data['sort_order'] ?? 0,
            'created_by' => $user->id,
        ]);

        $version = ContractClauseVersion::create([
            'tenant_id' => $user->tenant_id,
            'clause_id' => $clause->id,
            'version' => $data['version'] ?? 'v1.0',
            'body' => $data['body'],
            'status' => 'ACTIVE',
            'effective_date' => now()->toDateString(),
            'created_by' => $user->id,
        ]);

        $clause->update(['current_version_id' => $version->id]);

        return $clause->load('currentVersion');
    }

    public function addVersion(ContractClause $clause, User $user, array $data): ContractClauseVersion
    {
        return ContractClauseVersion::create([
            'tenant_id' => $clause->tenant_id,
            'clause_id' => $clause->id,
            'version' => $data['version'],
            'body' => $data['body'],
            'status' => 'DRAFT',
            'created_by' => $user->id,
        ]);
    }

    public function activateVersion(ContractClause $clause, ContractClauseVersion $version, User $user): ContractClause
    {
        ContractClauseVersion::where('clause_id', $clause->id)
            ->whereIn('status', ['ACTIVE'])
            ->where('id', '!=', $version->id)
            ->update(['status' => 'SUPERSEDED', 'superseded_at' => now()]);

        $version->update([
            'status' => 'ACTIVE',
            'effective_date' => $version->effective_date ?? now()->toDateString(),
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);

        $clause->update(['current_version_id' => $version->id]);

        return $clause->fresh(['currentVersion', 'versions']);
    }

    /**
     * Assign a clause to a contract, pinning the clause's active version. When
     * text is supplied that differs from the standard, it is recorded as a
     * deviation (PRD §33). Locked clauses cannot be deviated.
     */
    public function assign(Contract $contract, ContractClause $clause, User $user, array $data): ContractClauseAssignment
    {
        if ($contract->clauseAssignments()->where('clause_id', $clause->id)->exists()) {
            throw ValidationException::withMessages(['clause' => ['This clause is already assigned to the contract.']]);
        }

        $version = $clause->currentVersion;
        $deviationText = isset($data['deviation_text']) ? trim((string) $data['deviation_text']) : '';
        $isDeviation = $deviationText !== '' && $deviationText !== trim((string) optional($version)->body);

        if ($isDeviation && $clause->isLocked()) {
            throw ValidationException::withMessages(['clause' => ['This is a mandatory locked clause and cannot be modified.']]);
        }

        return ContractClauseAssignment::create([
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'clause_id' => $clause->id,
            'clause_version_id' => $version?->id,
            'is_deviation' => $isDeviation,
            'deviation_text' => $isDeviation ? $deviationText : null,
            'deviation_reason' => $isDeviation ? ($data['deviation_reason'] ?? null) : null,
            'deviation_author' => $isDeviation ? $user->id : null,
            'deviation_status' => $isDeviation ? 'pending' : null,
            'sort_order' => (int) $contract->clauseAssignments()->max('sort_order') + 1,
        ]);
    }

    public function unassign(Contract $contract, ContractClauseAssignment $assignment): void
    {
        $clause = $assignment->clause;
        if ($clause && $clause->isMandatory()) {
            throw ValidationException::withMessages(['clause' => ['Mandatory clauses cannot be removed from a contract.']]);
        }

        $assignment->delete();
    }
}
