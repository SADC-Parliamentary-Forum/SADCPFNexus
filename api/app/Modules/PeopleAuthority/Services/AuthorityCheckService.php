<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\ActingAppointment;
use App\Models\PeopleAuthority\AuthorityAssignment;
use App\Models\PeopleAuthority\AuthorityDefinition;
use App\Models\PeopleAuthority\AuthoritySnapshot;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\PeopleAuthority\IdentityDelegationScope;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\PeopleAuthority\PositionAssignment;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Server-side authority check (PRD §107).
 * System Admin / technical roles never auto-grant business authority.
 */
class AuthorityCheckService
{
    public function __construct(
        private readonly IdentityAuditService $audit,
    ) {}

    /**
     * @param  array{
     *   action:string,
     *   module?:?string,
     *   record_type?:?string,
     *   department_id?:?int,
     *   amount?:?float,
     *   currency?:?string,
     *   requester_user_id?:?int,
     *   requester_person_id?:?int,
     *   date?:?string,
     *   require_contract_signing?:bool,
     *   context_type?:?string,
     *   context_id?:?int,
     *   self_approval_policy?:?string,
     * }  $input
     * @return array{
     *   authorised:bool,
     *   authority_used:?array,
     *   role_used:?string,
     *   position_id:?int,
     *   delegation_id:?int,
     *   acting_appointment_id:?int,
     *   limitations:array,
     *   self_approval_conflict:bool,
     *   self_approval:bool,
     *   denial_reason:?string,
     *   snapshot_id:?int
     * }
     */
    public function check(User $user, array $input): array
    {
        $action = (string) ($input['action'] ?? '');
        $module = $input['module'] ?? null;
        $amount = isset($input['amount']) ? (float) $input['amount'] : null;
        $currency = $input['currency'] ?? null;
        $asOf = isset($input['date']) ? Carbon::parse($input['date']) : now();
        $requireContract = (bool) ($input['require_contract_signing'] ?? false);

        $selfApprovalPolicy = (string) ($input['self_approval_policy'] ?? \App\Models\ApprovalWorkflow::SELF_APPROVAL_DENIED);

        $result = [
            'authorised' => false,
            'authority_used' => null,
            'role_used' => null,
            'position_id' => null,
            'delegation_id' => null,
            'acting_appointment_id' => null,
            'limitations' => [],
            'self_approval_conflict' => false,
            'self_approval' => false,
            'denial_reason' => null,
            'snapshot_id' => null,
        ];

        if ($action === '') {
            $result['denial_reason'] = 'Action is required.';

            return $result;
        }

        // Technical administration ≠ business authority (PRD §43 / §128)
        if ($this->isTechnicalOnly($user) && ! $this->hasExplicitBusinessAuthority($user, $action, $module, $asOf)) {
            $result['denial_reason'] = 'System administration does not confer business approval authority.';
            $this->audit->record($user, 'authority.check.denied', null, null, null, [
                'reason' => $result['denial_reason'],
                'action' => $action,
                'module' => $module,
            ]);

            return $result;
        }

        $personId = $this->resolvePersonId($user);
        $positionId = $this->resolveActivePositionId($personId, $asOf);
        $result['position_id'] = $positionId;

        $requesterUserId = $input['requester_user_id'] ?? null;
        $requesterPersonId = $input['requester_person_id'] ?? null;
        $isSelfApproval = ($requesterUserId && (int) $requesterUserId === (int) $user->id)
            || ($requesterPersonId && $personId && (int) $requesterPersonId === (int) $personId);

        if ($isSelfApproval && $selfApprovalPolicy === \App\Models\ApprovalWorkflow::SELF_APPROVAL_ALLOW_WITH_CONTROLS) {
            // Permitted under the workflow's explicit policy (e.g. the
            // Secretary General approving her own leave in her institutional
            // capacity as Head of Institution, PRD §10-11). The caller
            // (WorkflowOrchestrator::decide) still requires a mandatory
            // comment, and this flag is preserved verbatim into
            // WorkflowDecision.authority_snapshot for the audit trail.
            $result['authorised'] = true;
            $result['self_approval'] = true;
            $result['role_used'] = 'self_approval:allow_with_controls';
            $this->audit->record($user, 'authority.check.self_approval_allowed', $personId, null, null, [
                'action' => $action,
                'module' => $module,
                'policy' => $selfApprovalPolicy,
            ]);

            return $result;
        }

        if ($isSelfApproval) {
            $result['self_approval_conflict'] = true;
            $result['denial_reason'] = $selfApprovalPolicy === \App\Models\ApprovalWorkflow::SELF_APPROVAL_REQUIRE_EXTERNAL_APPROVER
                ? 'This request requires approval by a designated external authority, not the requester.'
                : 'Self-approval is blocked by segregation of duties.';
            $this->audit->record($user, 'authority.check.self_approval_blocked', $personId, null, null, [
                'action' => $action,
                'module' => $module,
                'policy' => $selfApprovalPolicy,
            ]);

            return $result;
        }

        // Direct position / person authority
        $assignment = $this->findAuthorityAssignment($user, $personId, $positionId, $action, $module, $asOf, $amount, $currency, $requireContract);
        $delegationId = null;
        $actingId = null;

        if (! $assignment) {
            // Acting appointment authority (position-based while acting)
            $acting = $this->findActiveActing($personId, $asOf);
            if ($acting) {
                $actingId = $acting->id;
                $assignment = $this->findAuthorityForAssignee('ActingAppointment', $acting->id, $action, $module, $asOf, $amount, $currency, $requireContract)
                    ?: $this->findAuthorityForAssignee('Position', $acting->position_id, $action, $module, $asOf, $amount, $currency, $requireContract);
                // Acting ≠ automatic allowance
                if ($acting && ! $acting->grants_allowance) {
                    $result['limitations'][] = 'acting_without_allowance';
                }
                if ($acting?->is_acting_sg) {
                    $result['limitations'][] = 'acting_sg_restricted';
                }
            }
        }

        if (! $assignment) {
            // Delegation — never exceeds principal; no transitive by default; no contract-signing unless explicit
            $delegation = $this->findActiveDelegation($user, $personId, $action, $module, $asOf, $requireContract, $amount, $currency);
            if ($delegation) {
                $delegationId = $delegation->id;
                if ($requireContract && ! $delegation->allows_contract_signing) {
                    $result['denial_reason'] = 'General delegation does not create contract-signing authority.';

                    return $result;
                }
                // Principal must hold the authority; delegate cannot exceed
                $principalOk = $this->principalHoldsAuthority($delegation, $action, $module, $asOf, $amount, $currency, $requireContract);
                if (! $principalOk) {
                    $result['denial_reason'] = 'Delegation cannot exceed the principal\'s authority.';

                    return $result;
                }
                $assignment = $this->syntheticDelegationAuthority($delegation, $action, $module);
            }
        }

        if (! $assignment) {
            $result['denial_reason'] = 'No matching authority assignment found.';
            $this->audit->record($user, 'authority.check.denied', $personId, null, null, [
                'reason' => $result['denial_reason'],
                'action' => $action,
                'module' => $module,
            ]);

            return $result;
        }

        $result['authorised'] = true;
        $result['authority_used'] = is_array($assignment) ? $assignment : [
            'id' => $assignment->id ?? null,
            'authority_definition_id' => $assignment->authority_definition_id ?? null,
            'assignee_type' => $assignment->assignee_type ?? null,
            'assignee_id' => $assignment->assignee_id ?? null,
            'value_limit' => $assignment->value_limit ?? null,
            'currency' => $assignment->currency ?? null,
        ];
        $result['delegation_id'] = $delegationId;
        $result['acting_appointment_id'] = $actingId;
        $result['role_used'] = $user->getRoleNames()->first();

        if (! empty($input['context_type'])) {
            $snap = AuthoritySnapshot::create([
                'tenant_id' => $user->tenant_id,
                'context_type' => $input['context_type'],
                'context_id' => $input['context_id'] ?? null,
                'user_id' => $user->id,
                'person_id' => $personId,
                'position_id' => $positionId,
                'authority_assignment_id' => is_object($assignment) ? ($assignment->id ?? null) : ($assignment['id'] ?? null),
                'delegation_id' => $delegationId,
                'acting_appointment_id' => $actingId,
                'snapshot' => $result,
                'captured_at' => now(),
            ]);
            $result['snapshot_id'] = $snap->id;
        }

        $this->audit->record($user, 'authority.check.allowed', $personId, null, null, [
            'action' => $action,
            'module' => $module,
            'snapshot_id' => $result['snapshot_id'],
        ]);

        return $result;
    }

    private function isTechnicalOnly(User $user): bool
    {
        $roles = $user->getRoleNames()->map(fn ($r) => strtolower((string) $r));
        $tech = $roles->intersect(['system admin', 'super-admin', 'ict administrator', 'ict admin'])->isNotEmpty();
        if (! $tech) {
            return false;
        }
        // If they also hold an explicit business role, not technical-only
        $business = $roles->intersect([
            'secretary general', 'hr manager', 'finance controller', 'finance director',
            'director', 'head of department', 'procurement officer',
        ])->isNotEmpty();

        return ! $business;
    }

    private function hasExplicitBusinessAuthority(User $user, string $action, ?string $module, Carbon $asOf): bool
    {
        $personId = $this->resolvePersonId($user);
        $positionId = $this->resolveActivePositionId($personId, $asOf);

        return (bool) $this->findAuthorityAssignment($user, $personId, $positionId, $action, $module, $asOf, null, null, false);
    }

    public function resolvePersonId(User $user): ?int
    {
        $link = PersonUserLink::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderByRaw("CASE WHEN link_type = 'primary' THEN 0 ELSE 1 END")
            ->first();

        return $link?->person_id;
    }

    private function resolveActivePositionId(?int $personId, Carbon $asOf): ?int
    {
        if (! $personId) {
            return null;
        }

        return PositionAssignment::query()
            ->where('person_id', $personId)
            ->where('status', 'active')
            ->whereDate('start_at', '<=', $asOf->toDateString())
            ->where(function ($q) use ($asOf) {
                $q->whereNull('end_at')->orWhereDate('end_at', '>=', $asOf->toDateString());
            })
            ->orderByDesc('is_substantive')
            ->value('position_id');
    }

    private function findAuthorityAssignment(
        User $user,
        ?int $personId,
        ?int $positionId,
        string $action,
        ?string $module,
        Carbon $asOf,
        ?float $amount,
        ?string $currency,
        bool $requireContract
    ): ?AuthorityAssignment {
        if ($positionId) {
            $hit = $this->findAuthorityForAssignee('Position', $positionId, $action, $module, $asOf, $amount, $currency, $requireContract);
            if ($hit) {
                return $hit;
            }
        }
        if ($personId) {
            return $this->findAuthorityForAssignee('Person', $personId, $action, $module, $asOf, $amount, $currency, $requireContract);
        }

        return null;
    }

    private function findAuthorityForAssignee(
        string $assigneeType,
        int $assigneeId,
        string $action,
        ?string $module,
        Carbon $asOf,
        ?float $amount,
        ?string $currency,
        bool $requireContract
    ): ?AuthorityAssignment {
        $q = AuthorityAssignment::query()
            ->where('assignee_type', $assigneeType)
            ->where('assignee_id', $assigneeId)
            ->where('status', 'active')
            ->whereDate('effective_from', '<=', $asOf->toDateString())
            ->where(function ($q) use ($asOf) {
                $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $asOf->toDateString());
            })
            ->whereHas('definition', function ($dq) use ($action, $module, $requireContract) {
                $dq->where('is_active', true)
                    ->where(function ($a) use ($action) {
                        $a->whereNull('action')->orWhere('action', $action);
                    });
                if ($module) {
                    $dq->where(function ($m) use ($module) {
                        $m->whereNull('module')->orWhere('module', $module);
                    });
                }
                if ($requireContract) {
                    $dq->where('is_contract_signing', true);
                }
            });

        /** @var AuthorityAssignment|null $row */
        $row = $q->with('definition')->orderByRaw('value_limit IS NULL')->orderByDesc('value_limit')->first();
        if (! $row) {
            return null;
        }
        if ($amount !== null && $row->value_limit !== null && (float) $row->value_limit < $amount) {
            return null;
        }
        if ($currency && $row->currency && strtoupper($row->currency) !== strtoupper($currency)) {
            return null;
        }

        return $row;
    }

    private function findActiveActing(?int $personId, Carbon $asOf): ?ActingAppointment
    {
        if (! $personId) {
            return null;
        }

        return ActingAppointment::query()
            ->where('person_id', $personId)
            ->whereIn('status', ['approved', 'active'])
            ->whereDate('start_at', '<=', $asOf->toDateString())
            ->where(function ($q) use ($asOf) {
                $q->whereNull('end_at')->orWhereDate('end_at', '>=', $asOf->toDateString());
            })
            ->orderByDesc('is_acting_sg')
            ->first();
    }

    private function findActiveDelegation(
        User $user,
        ?int $personId,
        string $action,
        ?string $module,
        Carbon $asOf,
        bool $requireContract,
        ?float $amount,
        ?string $currency
    ): ?IdentityDelegation {
        $q = IdentityDelegation::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['approved', 'active'])
            ->where('start_at', '<=', $asOf)
            ->where('end_at', '>=', $asOf)
            ->where(function ($q) use ($user, $personId) {
                $q->where('delegate_user_id', $user->id);
                if ($personId) {
                    $q->orWhere('delegate_person_id', $personId);
                }
            });

        $candidates = $q->get();
        foreach ($candidates as $d) {
            if ($requireContract && ! $d->allows_contract_signing) {
                continue;
            }
            $scopeOk = IdentityDelegationScope::query()
                ->where('identity_delegation_id', $d->id)
                ->where(function ($s) use ($action) {
                    $s->where('action', $action)->orWhere('action', '*');
                })
                ->where(function ($s) use ($module) {
                    if ($module) {
                        $s->whereNull('module')->orWhere('module', $module)->orWhere('module', '*');
                    }
                })
                ->when($amount !== null, function ($s) use ($amount) {
                    $s->where(function ($x) use ($amount) {
                        $x->whereNull('value_limit')->orWhere('value_limit', '>=', $amount);
                    });
                })
                ->exists();

            // If no scopes defined for workflow/preparation types, deny for approve/sign
            if (! $scopeOk) {
                if (in_array($action, ['approve', 'sign'], true)) {
                    continue;
                }
                // preparation/draft may use delegation_type alone
                if (! in_array($d->delegation_type, ['preparation', 'workflow', 'general'], true)) {
                    continue;
                }
            }

            return $d;
        }

        return null;
    }

    private function principalHoldsAuthority(
        IdentityDelegation $delegation,
        string $action,
        ?string $module,
        Carbon $asOf,
        ?float $amount,
        ?string $currency,
        bool $requireContract
    ): bool {
        $principalPersonId = $delegation->principal_person_id;
        $positionId = $this->resolveActivePositionId($principalPersonId, $asOf);
        if ($positionId && $this->findAuthorityForAssignee('Position', $positionId, $action, $module, $asOf, $amount, $currency, $requireContract)) {
            return true;
        }

        return (bool) $this->findAuthorityForAssignee('Person', $principalPersonId, $action, $module, $asOf, $amount, $currency, $requireContract);
    }

    private function syntheticDelegationAuthority(IdentityDelegation $delegation, string $action, ?string $module): array
    {
        return [
            'id' => null,
            'authority_definition_id' => null,
            'assignee_type' => 'Delegation',
            'assignee_id' => $delegation->id,
            'value_limit' => null,
            'currency' => null,
            'action' => $action,
            'module' => $module,
            'via_delegation' => true,
        ];
    }
}
