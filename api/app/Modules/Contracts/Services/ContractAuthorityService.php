<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractAuthorityDelegation;
use App\Models\ContractAuthorityRule;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Evaluates the Contract Authority Matrix (PRD §41) and delegated/acting
 * authority (PRD §42) at the moment an action is taken. Enforcement is
 * additive: when no matching rule is configured, the caller's existing RBAC
 * permission checks stand; when a rule matches, the actor must hold the
 * authorised/alternate role or an in-force delegation.
 */
class ContractAuthorityService
{
    /**
     * Active rules that match this action, contract type and contract value,
     * effective as of now — most specific (type-bound, highest floor) first.
     *
     * @return Collection<int, ContractAuthorityRule>
     */
    public function matchingRules(string $action, Contract $contract): Collection
    {
        $value = (float) $contract->current_value;
        $today = now()->startOfDay();

        return ContractAuthorityRule::query()
            ->where('tenant_id', $contract->tenant_id)
            ->where('is_active', true)
            ->where('action', $action)
            ->get()
            ->filter(function (ContractAuthorityRule $r) use ($contract, $value, $today) {
                if ($r->contract_type_id !== null && (int) $r->contract_type_id !== (int) $contract->type_id) {
                    return false;
                }
                if ($r->currency !== null && $contract->currency !== null && $r->currency !== $contract->currency) {
                    return false;
                }
                if ($value < (float) $r->amount_floor) {
                    return false;
                }
                if ($r->amount_ceiling !== null && $value > (float) $r->amount_ceiling) {
                    return false;
                }
                if ($r->effective_from !== null && $today->lt($r->effective_from->startOfDay())) {
                    return false;
                }
                if ($r->effective_until !== null && $today->gt($r->effective_until->startOfDay())) {
                    return false;
                }

                return true;
            })
            ->sortByDesc(fn (ContractAuthorityRule $r) => [$r->contract_type_id !== null ? 1 : 0, (float) $r->amount_floor])
            ->values();
    }

    /**
     * Roles that satisfy this action for the contract (union across matching
     * rules). Empty when the matrix does not govern this action/value.
     *
     * @return list<string>
     */
    public function requiredRoles(string $action, Contract $contract): array
    {
        return $this->matchingRules($action, $contract)
            ->flatMap(fn (ContractAuthorityRule $r) => $r->roles())
            ->unique()
            ->values()
            ->all();
    }

    /** In-force delegations that let this user act on behalf of a role. */
    public function activeDelegationRoles(User $user, string $action): array
    {
        return ContractAuthorityDelegation::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('delegate_user_id', $user->id)
            ->where('is_active', true)
            ->get()
            ->filter(fn (ContractAuthorityDelegation $d) => $d->isLiveFor($action))
            ->map(fn (ContractAuthorityDelegation $d) => $d->delegator_role)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * Whether the user is authorised for this action on this contract.
     * True when the matrix does not govern it (defer to RBAC), or the user
     * holds an authorised role, or holds an in-force delegation for such a role.
     */
    public function userMayAct(User $user, string $action, Contract $contract): bool
    {
        $required = $this->requiredRoles($action, $contract);
        if ($required === []) {
            return true;
        }

        foreach ($required as $role) {
            if ($user->hasRole($role)) {
                return true;
            }
        }

        $delegated = $this->activeDelegationRoles($user, $action);

        return array_intersect($required, $delegated) !== [];
    }

    /**
     * Separation-of-duties conflict (PRD §40): the actor also created or owns
     * the contract. Flag rather than hard-block unless policy dictates.
     */
    public function separationOfDutiesConflict(User $user, Contract $contract): bool
    {
        return (int) $contract->created_by === (int) $user->id
            || (int) $contract->contract_owner_id === (int) $user->id
            || (int) $contract->procurement_officer_id === (int) $user->id;
    }
}
