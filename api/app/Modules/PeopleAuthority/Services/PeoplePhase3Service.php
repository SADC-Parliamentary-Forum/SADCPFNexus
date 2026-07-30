<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\ActingAppointment;
use App\Models\PeopleAuthority\AuthorityAssignment;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\PeopleAuthority\OrganisationalUnit;
use App\Models\PeopleAuthority\PeoplePersonSkill;
use App\Models\PeopleAuthority\PeoplePrivilegeAlert;
use App\Models\PeopleAuthority\PeopleSkill;
use App\Models\PeopleAuthority\PeopleSuccessionCandidate;
use App\Models\PeopleAuthority\PeopleSuccessionPlan;
use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\PositionAssignment;
use App\Models\PeopleAuthority\UserRoleAssignment;
use App\Models\Position;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * People & Authority Phase 3 capabilities (PRD §127).
 */
class PeoplePhase3Service
{
    public function __construct(private readonly IdentityAuditService $audit) {}

    public function listSuccessionPlans(User $actor)
    {
        return PeopleSuccessionPlan::query()
            ->where('tenant_id', $actor->tenant_id)
            ->with('candidates')
            ->latest('id')
            ->paginate(25);
    }

    public function createSuccessionPlan(User $actor, array $data): PeopleSuccessionPlan
    {
        Position::query()->where('tenant_id', $actor->tenant_id)->findOrFail($data['position_id']);

        $plan = PeopleSuccessionPlan::create([
            'tenant_id' => $actor->tenant_id,
            'position_id' => $data['position_id'],
            'title' => $data['title'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'notes' => $data['notes'] ?? null,
            'created_by' => $actor->id,
        ]);

        foreach ($data['candidates'] ?? [] as $cand) {
            PeopleSuccessionCandidate::create([
                'tenant_id' => $actor->tenant_id,
                'succession_plan_id' => $plan->id,
                'person_id' => $cand['person_id'],
                'readiness' => $cand['readiness'] ?? 'developing',
                'rank' => $cand['rank'] ?? null,
                'notes' => $cand['notes'] ?? null,
            ]);
        }

        $this->audit->record($actor, 'succession.plan_created', null, PeopleSuccessionPlan::class, $plan->id);

        return $plan->load('candidates');
    }

    public function listSkills(User $actor)
    {
        return PeopleSkill::query()
            ->where(function ($q) use ($actor) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $actor->tenant_id);
            })
            ->where('is_active', true)
            ->orderBy('name')
            ->paginate(100);
    }

    public function createSkill(User $actor, array $data): PeopleSkill
    {
        return PeopleSkill::create([
            'tenant_id' => $actor->tenant_id,
            'code' => $data['code'],
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'description' => $data['description'] ?? null,
            'is_active' => true,
        ]);
    }

    public function assignPersonSkill(User $actor, array $data): PeoplePersonSkill
    {
        Person::query()->where('tenant_id', $actor->tenant_id)->findOrFail($data['person_id']);
        PeopleSkill::query()
            ->where(function ($q) use ($actor) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $actor->tenant_id);
            })
            ->findOrFail($data['skill_id']);

        $row = PeoplePersonSkill::updateOrCreate(
            [
                'person_id' => $data['person_id'],
                'skill_id' => $data['skill_id'],
            ],
            [
                'tenant_id' => $actor->tenant_id,
                'level' => $data['level'] ?? 'working',
                'assessed_on' => $data['assessed_on'] ?? now()->toDateString(),
                'evidence_notes' => $data['evidence_notes'] ?? null,
                'recorded_by' => $actor->id,
            ]
        );

        return $row;
    }

    public function listPersonSkills(User $actor, int $personId)
    {
        return PeoplePersonSkill::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('person_id', $personId)
            ->orderBy('id')
            ->get();
    }

    public function detectAnomalousPrivileges(User $actor): array
    {
        $alerts = [];

        // Privileged role without approved status lingering
        $pendingPriv = UserRoleAssignment::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('is_privileged', true)
            ->where('status', 'pending')
            ->where('created_at', '<=', now()->subDays(14))
            ->limit(50)
            ->get();

        foreach ($pendingPriv as $row) {
            $alerts[] = $this->upsertAlert($actor, [
                'person_id' => $row->person_id,
                'user_id' => $row->user_id,
                'alert_type' => 'stale_privileged_role_pending',
                'severity' => 'medium',
                'details' => [
                    'user_role_assignment_id' => $row->id,
                    'role_name' => $row->role_name,
                    'suggestion' => 'Review and approve or revoke — never auto-grant.',
                ],
            ]);
        }

        // Privileged role holders who also have person-scoped authority assignments
        $privRows = UserRoleAssignment::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('is_privileged', true)
            ->where('status', 'active')
            ->whereNotNull('person_id')
            ->limit(100)
            ->get();

        foreach ($privRows as $row) {
            $authCount = AuthorityAssignment::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('status', 'active')
                ->where('assignee_type', 'Person')
                ->where('assignee_id', $row->person_id)
                ->count();

            if ($authCount === 0) {
                continue;
            }

            $alerts[] = $this->upsertAlert($actor, [
                'user_id' => $row->user_id,
                'person_id' => $row->person_id,
                'alert_type' => 'privileged_role_with_authority',
                'severity' => 'high',
                'details' => [
                    'active_authority_count' => $authCount,
                    'role_name' => $row->role_name,
                    'suggestion' => 'Segregate technical privilege from business authority where possible.',
                ],
            ]);
        }

        // Overlapping acting + delegation on same substantive principal
        $acting = ActingAppointment::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', ['active', 'approved'])
            ->limit(100)
            ->get();

        foreach ($acting as $appt) {
            $principal = $appt->substantive_person_id ?: $appt->person_id;
            $delCount = IdentityDelegation::query()
                ->where('tenant_id', $actor->tenant_id)
                ->whereIn('status', ['active', 'approved'])
                ->where('principal_person_id', $principal)
                ->count();
            if ($delCount > 0) {
                $alerts[] = $this->upsertAlert($actor, [
                    'person_id' => $principal,
                    'alert_type' => 'acting_and_delegation_overlap',
                    'severity' => 'medium',
                    'details' => [
                        'acting_appointment_id' => $appt->id,
                        'active_delegations' => $delCount,
                        'suggestion' => 'Confirm acting vs delegation scopes do not double authority.',
                    ],
                ]);
            }
        }

        return [
            'detected' => count($alerts),
            'alerts' => $alerts,
            'note' => 'Alerts and suggestions only — never auto-revoke or auto-grant.',
        ];
    }

    public function listPrivilegeAlerts(User $actor)
    {
        return PeoplePrivilegeAlert::query()
            ->where('tenant_id', $actor->tenant_id)
            ->latest('id')
            ->paginate(50);
    }

    public function acknowledgePrivilegeAlert(User $actor, PeoplePrivilegeAlert $alert): PeoplePrivilegeAlert
    {
        if ((int) $alert->tenant_id !== (int) $actor->tenant_id) {
            throw ValidationException::withMessages(['tenant' => ['Tenant mismatch.']]);
        }

        $alert->update([
            'status' => 'acknowledged',
            'acknowledged_by' => $actor->id,
            'acknowledged_at' => now(),
        ]);

        return $alert->fresh();
    }

    public function nlOrgSearch(User $actor, string $query): array
    {
        $q = trim($query);
        if ($q === '') {
            return ['query' => $q, 'results' => []];
        }

        $people = Person::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('directory_visible', true)
            ->where(function ($builder) use ($q) {
                $builder->where('display_name', 'ilike', "%{$q}%")
                    ->orWhere('first_name', 'ilike', "%{$q}%")
                    ->orWhere('last_name', 'ilike', "%{$q}%")
                    ->orWhere('work_email', 'ilike', "%{$q}%");
            })
            ->limit(20)
            ->get(['id', 'display_name', 'work_email', 'primary_unit_id']);

        // SQLite tests may not support ilike — fall back
        if ($people->isEmpty() && DB::connection()->getDriverName() !== 'pgsql') {
            $people = Person::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('directory_visible', true)
                ->where(function ($builder) use ($q) {
                    $builder->where('display_name', 'like', "%{$q}%")
                        ->orWhere('first_name', 'like', "%{$q}%")
                        ->orWhere('last_name', 'like', "%{$q}%")
                        ->orWhere('work_email', 'like', "%{$q}%");
                })
                ->limit(20)
                ->get(['id', 'display_name', 'work_email', 'primary_unit_id']);
        }

        $units = OrganisationalUnit::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($builder) use ($q) {
                $builder->where('name', 'like', "%{$q}%")->orWhere('code', 'like', "%{$q}%");
            })
            ->limit(20)
            ->get(['id', 'code', 'name', 'unit_type']);

        $positions = Position::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($builder) use ($q) {
                $builder->where('title', 'like', "%{$q}%")->orWhere('code', 'like', "%{$q}%");
            })
            ->limit(20)
            ->get(['id', 'title', 'code']);

        return [
            'query' => $q,
            'results' => [
                'people' => $people,
                'units' => $units,
                'positions' => $positions,
            ],
            'note' => 'Basic keyword search over directory/org fields — not an LLM auto-action.',
        ];
    }

    public function analytics(User $actor): array
    {
        $tenantId = $actor->tenant_id;

        return [
            'people_active' => Person::query()->where('tenant_id', $tenantId)->where('employment_status', 'active')->count(),
            'units_active' => OrganisationalUnit::query()->where('tenant_id', $tenantId)->where('status', 'active')->count(),
            'positions' => Position::query()->where('tenant_id', $tenantId)->count(),
            'active_assignments' => PositionAssignment::query()->where('tenant_id', $tenantId)->where('status', 'active')->count(),
            'active_delegations' => IdentityDelegation::query()->where('tenant_id', $tenantId)->where('status', 'active')->count(),
            'active_acting' => ActingAppointment::query()->where('tenant_id', $tenantId)->where('status', 'active')->count(),
            'privileged_roles_pending' => UserRoleAssignment::query()->where('tenant_id', $tenantId)->where('is_privileged', true)->where('status', 'pending')->count(),
            'skills_catalog' => PeopleSkill::query()->where(function ($q) use ($tenantId) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $tenantId);
            })->where('is_active', true)->count(),
            'succession_plans' => PeopleSuccessionPlan::query()->where('tenant_id', $tenantId)->count(),
            'open_privilege_alerts' => PeoplePrivilegeAlert::query()->where('tenant_id', $tenantId)->where('status', 'open')->count(),
        ];
    }

    private function upsertAlert(User $actor, array $data): PeoplePrivilegeAlert
    {
        $existing = PeoplePrivilegeAlert::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('alert_type', $data['alert_type'])
            ->where('status', 'open')
            ->when(! empty($data['user_id']), fn ($q) => $q->where('user_id', $data['user_id']))
            ->when(! empty($data['person_id']), fn ($q) => $q->where('person_id', $data['person_id']))
            ->first();

        if ($existing) {
            $existing->update(['details' => $data['details'], 'severity' => $data['severity']]);

            return $existing->fresh();
        }

        return PeoplePrivilegeAlert::create([
            'tenant_id' => $actor->tenant_id,
            'person_id' => $data['person_id'] ?? null,
            'user_id' => $data['user_id'] ?? null,
            'alert_type' => $data['alert_type'],
            'severity' => $data['severity'],
            'status' => 'open',
            'details' => $data['details'],
            'detected_by' => $actor->id,
            'detected_at' => now(),
        ]);
    }
}
