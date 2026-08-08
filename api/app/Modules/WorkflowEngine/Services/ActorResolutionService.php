<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalStep;
use App\Models\Department;
use App\Models\PeopleAuthority\ActingAppointment;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\PeopleAuthority\PositionAssignment;
use App\Models\PeopleAuthority\ReportingRelationship;
use App\Models\User;
use App\Modules\PeopleAuthority\Services\ReportingRelationshipService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Resolve workflow stage actors via positions / hierarchy / authority —
 * never hard-coded personal names (PRD §18–§24, §124).
 */
class ActorResolutionService
{
    public function __construct(
        private readonly ?ReportingRelationshipService $reporting = null,
    ) {}

    /**
     * @return array{actors: User[], reason: string, selector: string, snapshots: array}
     */
    public function resolve(ApprovalStep $step, User $requester, array $context = []): array
    {
        $selector = $step->actor_selector ?: $step->approver_type;
        $config = $step->actor_selector_config ?? [];
        $asOf = isset($context['as_of']) ? Carbon::parse($context['as_of']) : now();

        $result = match ($selector) {
            'supervisor', 'direct_supervisor' => $this->resolveSupervisor($requester, $asOf),
            'hod', 'department_head', 'up_the_chain' => $this->resolveHod($requester, $step, $context, $asOf),
            'director_finance', 'df' => $this->resolveByRoleOrAuthority('Director', 'finance.authorise', $requester, $config),
            'sg', 'secretary_general' => $this->resolveByRoleOrAuthority('Secretary General', 'sg.approve', $requester, $config),
            'position' => $this->resolveByPosition((int) ($config['position_id'] ?? 0), $requester->tenant_id, $asOf),
            'queue' => $this->resolveQueue((string) ($config['queue'] ?? ''), $requester->tenant_id),
            'authority_holder' => $this->resolveAuthorityHolder(
                (string) ($step->authority_action ?: ($config['action'] ?? 'approve')),
                $requester,
                $context
            ),
            'specific_role' => $this->resolveSpecificRole($step, $requester),
            'specific_user' => $this->resolveSpecificUser($step),
            default => $this->resolveSpecificRole($step, $requester),
        };

        // Expand acting appointments & identity delegations covering these principals
        $expanded = $this->expandActingAndDelegation($result['actors'], $requester->tenant_id, $asOf, $step);

        // Disabled/locked/suspended accounts must never resolve as an approver,
        // regardless of which selector path found them (direct, position,
        // role, acting appointment, or delegation) — a single filter point
        // here covers every current and future resolver rather than needing
        // an is_active check duplicated into each individual query above.
        $activeActors = array_values(array_filter(
            $expanded['actors'],
            fn (User $u) => $u->accountAllowsAuthentication()
        ));

        $reason = $result['reason'];
        if ($activeActors === [] && $expanded['actors'] !== []) {
            $reason = 'Resolved actor(s) exist but their account(s) are inactive, locked, or suspended.';
        }

        return [
            'actors' => $activeActors,
            'reason' => $reason,
            'selector' => $selector,
            'snapshots' => array_merge($result['snapshots'] ?? [], $expanded['snapshots']),
        ];
    }

    private function resolveSupervisor(User $requester, Carbon $asOf): array
    {
        $supervisor = null;
        $personId = $this->personIdForUser($requester);
        if ($personId) {
            $rel = ReportingRelationship::query()
                ->where('tenant_id', $requester->tenant_id)
                ->where('subordinate_person_id', $personId)
                ->where('status', 'active')
                ->where(function ($q) use ($asOf) {
                    $q->whereNull('effective_from')->orWhere('effective_from', '<=', $asOf->toDateString());
                })
                ->where(function ($q) use ($asOf) {
                    $q->whereNull('effective_to')->orWhere('effective_to', '>=', $asOf->toDateString());
                })
                ->orderByDesc('id')
                ->first();
            if ($rel) {
                $supervisor = $this->userForPerson((int) $rel->supervisor_person_id);
            }
        }

        if (! $supervisor && $requester->department_id) {
            $dept = Department::find($requester->department_id);
            if ($dept?->head_user_id) {
                $supervisor = User::find($dept->head_user_id);
            }
        }

        if (! $supervisor && method_exists($requester, 'manager') && $requester->manager) {
            $supervisor = $requester->manager;
        }

        return [
            'actors' => $supervisor ? [$supervisor] : [],
            'reason' => $supervisor
                ? 'Resolved via organisational hierarchy (direct supervisor).'
                : 'No supervisor found in hierarchy.',
            'snapshots' => ['hierarchy' => 'supervisor'],
        ];
    }

    private function resolveHod(User $requester, ApprovalStep $step, array $context, Carbon $asOf): array
    {
        $level = (int) ($context['chain_level'] ?? 1);
        $current = $requester;
        $found = null;
        for ($i = 0; $i < max(1, $level); $i++) {
            $sup = $this->resolveSupervisor($current, $asOf);
            $found = $sup['actors'][0] ?? null;
            if (! $found) {
                break;
            }
            $current = $found;
        }

        // Prefer department head when up_the_chain exhausted
        if (! $found && $requester->department_id) {
            $dept = Department::find($requester->department_id);
            if ($dept?->head_user_id) {
                $found = User::find($dept->head_user_id);
            }
        }

        return [
            'actors' => $found ? [$found] : [],
            'reason' => $found
                ? 'Resolved via department / reporting-line head.'
                : 'No HOD / chain manager found.',
            'snapshots' => ['hierarchy' => 'hod', 'level' => $level],
        ];
    }

    private function resolveByRoleOrAuthority(string $roleName, string $authorityAction, User $requester, array $config): array
    {
        $users = User::role($roleName)
            ->where('tenant_id', $requester->tenant_id)
            ->get()
            ->all();

        return [
            'actors' => $users,
            'reason' => "Resolved by institutional role ({$roleName}) / authority action {$authorityAction}.",
            'snapshots' => ['role' => $roleName, 'authority_action' => $authorityAction],
        ];
    }

    private function resolveByPosition(int $positionId, int $tenantId, Carbon $asOf): array
    {
        if ($positionId <= 0) {
            return ['actors' => [], 'reason' => 'Position selector missing position_id.', 'snapshots' => []];
        }

        $assignment = PositionAssignment::query()
            ->where('tenant_id', $tenantId)
            ->where('position_id', $positionId)
            ->where('status', 'active')
            ->where(function ($q) use ($asOf) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $asOf->toDateString());
            })
            ->where(function ($q) use ($asOf) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', $asOf->toDateString());
            })
            ->orderByDesc('id')
            ->first();

        $user = $assignment ? $this->userForPerson((int) $assignment->person_id) : null;

        return [
            'actors' => $user ? [$user] : [],
            'reason' => $user
                ? "Resolved via position occupancy (position #{$positionId})."
                : "Position #{$positionId} is vacant.",
            'snapshots' => ['position_id' => $positionId, 'assignment_id' => $assignment?->id],
        ];
    }

    private function resolveQueue(string $queue, int $tenantId): array
    {
        // Queue means any user with a matching queue tag in actor_selector_config / role
        if ($queue === '') {
            return ['actors' => [], 'reason' => 'Queue name missing.', 'snapshots' => []];
        }

        $users = User::role($queue)->where('tenant_id', $tenantId)->get()->all();

        return [
            'actors' => $users,
            'reason' => "Assigned to approval queue '{$queue}'.",
            'snapshots' => ['queue' => $queue],
        ];
    }

    private function resolveAuthorityHolder(string $action, User $requester, array $context): array
    {
        // Fallback: users with Finance Controller / Director / SG roles for common actions
        $roleMap = [
            'finance.certify' => 'Finance Controller',
            'finance.authorise' => 'Director',
            'sg.approve' => 'Secretary General',
            'leave.recommend' => 'HR Manager',
            'leave.certify' => 'HR Administrator',
        ];
        $role = $roleMap[$action] ?? null;
        if ($role) {
            return $this->resolveByRoleOrAuthority($role, $action, $requester, []);
        }

        return [
            'actors' => [],
            'reason' => "No authority holders resolved for action {$action}.",
            'snapshots' => ['authority_action' => $action],
        ];
    }

    private function resolveSpecificRole(ApprovalStep $step, User $requester): array
    {
        if (! $step->role) {
            $step->loadMissing('role');
        }
        if (! $step->role) {
            return ['actors' => [], 'reason' => 'Specific role not configured.', 'snapshots' => []];
        }
        $users = User::role($step->role->name)
            ->where('tenant_id', $requester->tenant_id)
            ->get()
            ->all();

        return [
            'actors' => $users,
            'reason' => "Resolved by role '{$step->role->name}'.",
            'snapshots' => ['role_id' => $step->role_id, 'role' => $step->role->name],
        ];
    }

    private function resolveSpecificUser(ApprovalStep $step): array
    {
        $user = $step->user_id ? User::find($step->user_id) : null;

        return [
            'actors' => $user ? [$user] : [],
            'reason' => $user
                ? 'Resolved by configured position occupant (specific user fallback).'
                : 'Specific user not found.',
            'snapshots' => ['user_id' => $step->user_id],
        ];
    }

    /**
     * Include active acting appointees and identity delegates for principals.
     */
    private function expandActingAndDelegation(array $actors, int $tenantId, Carbon $asOf, ApprovalStep $step): array
    {
        $out = collect($actors);
        $snapshots = [];

        foreach ($actors as $principal) {
            $personId = $this->personIdForUser($principal);
            if (! $personId) {
                continue;
            }

            $acting = ActingAppointment::query()
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->where('substantive_person_id', $personId)
                ->where(function ($q) use ($asOf) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', $asOf->toDateString());
                })
                ->where(function ($q) use ($asOf) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', $asOf->toDateString());
                })
                ->get();

            foreach ($acting as $appt) {
                $u = $this->userForPerson((int) $appt->person_id);
                if ($u) {
                    $out->push($u);
                    $snapshots[] = ['acting_appointment_id' => $appt->id, 'for_user_id' => $principal->id];
                }
            }

            $delegations = IdentityDelegation::query()
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->where('principal_person_id', $personId)
                ->where(function ($q) use ($asOf) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', $asOf);
                })
                ->where(function ($q) use ($asOf) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', $asOf);
                })
                ->get();

            foreach ($delegations as $del) {
                $u = $del->delegate_user_id
                    ? User::find($del->delegate_user_id)
                    : $this->userForPerson((int) $del->delegate_person_id);
                if ($u) {
                    $out->push($u);
                    $snapshots[] = ['delegation_id' => $del->id, 'for_user_id' => $principal->id];
                }
            }
        }

        return [
            'actors' => $out->unique('id')->values()->all(),
            'snapshots' => $snapshots,
        ];
    }

    private function personIdForUser(User $user): ?int
    {
        $link = PersonUserLink::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->orderByDesc('id')
            ->first();

        return $link?->person_id ? (int) $link->person_id : null;
    }

    private function userForPerson(int $personId): ?User
    {
        $link = PersonUserLink::query()
            ->where('person_id', $personId)
            ->where('status', 'active')
            ->orderByDesc('id')
            ->first();

        return $link?->user_id ? User::find($link->user_id) : null;
    }
}
