<?php

namespace App\Http\Controllers\Api\V1\PeopleAuthority;

use App\Http\Controllers\Controller;
use App\Models\PeopleAuthority\AccessReviewCampaign;
use App\Models\PeopleAuthority\AccessReviewItem;
use App\Models\PeopleAuthority\ActingAppointment;
use App\Models\PeopleAuthority\AuthorityAssignment;
use App\Models\PeopleAuthority\AuthorityDefinition;
use App\Models\PeopleAuthority\DocumentSignatureEvent;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\PeopleAuthority\IdentityDelegationScope;
use App\Models\PeopleAuthority\JobDescription;
use App\Models\PeopleAuthority\JobDescriptionVersion;
use App\Models\PeopleAuthority\OffboardingCase;
use App\Models\PeopleAuthority\OnboardingCase;
use App\Models\PeopleAuthority\OrganisationalUnit;
use App\Models\PeopleAuthority\OrganisationalUnitVersion;
use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\PersonConfidentialProfile;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\PeopleAuthority\PositionAssignment;
use App\Models\PeopleAuthority\PositionVersion;
use App\Models\PeopleAuthority\ProfileChangeRequest;
use App\Models\PeopleAuthority\ReportingRelationship;
use App\Models\PeopleAuthority\SignatureEnrolment;
use App\Models\PeopleAuthority\TransferCase;
use App\Models\PeopleAuthority\UserRoleAssignment;
use App\Models\Position;
use App\Models\User;
use App\Modules\AccessControl\Services\CanonicalRoleManager;
use App\Modules\PeopleAuthority\Services\AuthorityCheckService;
use App\Modules\PeopleAuthority\Services\ConfidentialAccessGate;
use App\Modules\PeopleAuthority\Services\IdentityAuditService;
use App\Modules\PeopleAuthority\Services\ReportingRelationshipService;
use App\Modules\PeopleAuthority\Services\SigningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PeopleAuthorityController extends Controller
{
    public function __construct(
        private readonly AuthorityCheckService $authority,
        private readonly SigningService $signing,
        private readonly ReportingRelationshipService $reporting,
        private readonly ConfidentialAccessGate $confidential,
        private readonly IdentityAuditService $audit,
    ) {}

    // ── People ───────────────────────────────────────────────────────────────

    public function peopleIndex(Request $request): JsonResponse
    {
        $q = Person::query()->where('tenant_id', $request->user()->tenant_id);
        if ($request->boolean('directory')) {
            $q->where('directory_visible', true);
        }
        if ($search = $request->query('q')) {
            $like = '%'.$search.'%';
            $q->where(function ($w) use ($like) {
                $w->where('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('work_email', 'like', $like)
                    ->orWhere('display_name', 'like', $like);
            });
        }

        $rows = $q->orderBy('last_name')->paginate($request->integer('per_page', 50));
        $rows->getCollection()->transform(fn (Person $p) => $this->confidential->directoryPayload($p));

        return response()->json($rows);
    }

    public function peopleStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'person_number' => ['nullable', 'string', 'max:64'],
            'title' => ['nullable', 'string', 'max:32'],
            'preferred_name' => ['nullable', 'string', 'max:255'],
            'display_name' => ['nullable', 'string', 'max:255'],
            'person_type' => ['nullable', 'string', 'max:32'],
            'employment_status' => ['nullable', 'string', 'max:32'],
            'work_email' => ['nullable', 'email'],
            'work_phone' => ['nullable', 'string', 'max:64'],
            'mobile_phone' => ['nullable', 'string', 'max:64'],
            'office_location' => ['nullable', 'string', 'max:255'],
            'primary_unit_id' => ['nullable', 'integer'],
            'start_date' => ['nullable', 'date'],
            'directory_visible' => ['nullable', 'boolean'],
            'directory_meta' => ['nullable', 'array'],
            'operational_meta' => ['nullable', 'array'],
            'confidential' => ['nullable', 'array'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $user = $request->user();
        $person = Person::create([
            'tenant_id' => $user->tenant_id,
            'person_number' => $data['person_number'] ?? null,
            'title' => $data['title'] ?? null,
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'preferred_name' => $data['preferred_name'] ?? null,
            'display_name' => $data['display_name'] ?? trim($data['first_name'].' '.$data['last_name']),
            'person_type' => $data['person_type'] ?? 'employee',
            'employment_status' => $data['employment_status'] ?? 'active',
            'work_email' => $data['work_email'] ?? null,
            'work_phone' => $data['work_phone'] ?? null,
            'mobile_phone' => $data['mobile_phone'] ?? null,
            'office_location' => $data['office_location'] ?? null,
            'primary_unit_id' => $data['primary_unit_id'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'directory_visible' => $data['directory_visible'] ?? true,
            'directory_meta' => $data['directory_meta'] ?? null,
            'operational_meta' => $data['operational_meta'] ?? null,
            'created_by' => $user->id,
        ]);

        if (! empty($data['confidential'])) {
            $this->confidential->assertConfidential($user);
            PersonConfidentialProfile::create(array_merge($data['confidential'], [
                'tenant_id' => $user->tenant_id,
                'person_id' => $person->id,
            ]));
        }

        if (! empty($data['user_id'])) {
            $this->linkUser($user, $person->id, (int) $data['user_id']);
        }

        $this->audit->record($user, 'person.created', $person->id, Person::class, $person->id);
        $this->notifyPrivacySafe($user, 'people.person_created', 'A person profile was created.');

        return response()->json(['data' => $this->confidential->profilePayload($person->fresh(), $user)], 201);
    }

    public function peopleShow(Request $request, Person $person): JsonResponse
    {
        $this->assertTenant($request, $person->tenant_id);

        return response()->json(['data' => $this->confidential->profilePayload($person, $request->user())]);
    }

    public function peopleUpdate(Request $request, Person $person): JsonResponse
    {
        $this->assertTenant($request, $person->tenant_id);
        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:255'],
            'last_name' => ['sometimes', 'string', 'max:255'],
            'preferred_name' => ['nullable', 'string', 'max:255'],
            'display_name' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['nullable', 'string', 'max:32'],
            'work_email' => ['nullable', 'email'],
            'work_phone' => ['nullable', 'string', 'max:64'],
            'mobile_phone' => ['nullable', 'string', 'max:64'],
            'office_location' => ['nullable', 'string', 'max:255'],
            'primary_unit_id' => ['nullable', 'integer'],
            'directory_visible' => ['nullable', 'boolean'],
            'directory_meta' => ['nullable', 'array'],
            'operational_meta' => ['nullable', 'array'],
            'confidential' => ['nullable', 'array'],
        ]);

        $person->fill(collect($data)->except('confidential')->all())->save();

        if (array_key_exists('confidential', $data)) {
            $this->confidential->assertConfidential($request->user());
            PersonConfidentialProfile::updateOrCreate(
                ['person_id' => $person->id],
                array_merge($data['confidential'] ?? [], ['tenant_id' => $person->tenant_id])
            );
        }

        $this->audit->record($request->user(), 'person.updated', $person->id, Person::class, $person->id);

        return response()->json(['data' => $this->confidential->profilePayload($person->fresh(), $request->user())]);
    }

    public function peopleProfile(Request $request, Person $person): JsonResponse
    {
        return $this->peopleShow($request, $person);
    }

    public function linkAccount(Request $request, Person $person): JsonResponse
    {
        $this->assertTenant($request, $person->tenant_id);
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'link_type' => ['nullable', 'string', 'max:32'],
        ]);

        // No password storage — Auth owns credentials
        $link = $this->linkUser($request->user(), $person->id, (int) $data['user_id'], $data['link_type'] ?? 'primary');

        return response()->json(['data' => $link], 201);
    }

    public function changeRequestStore(Request $request, Person $person): JsonResponse
    {
        $this->assertTenant($request, $person->tenant_id);
        $data = $request->validate([
            'field_group' => ['required', 'in:directory,operational,confidential'],
            'proposed_changes' => ['required', 'array'],
        ]);

        if ($data['field_group'] === 'confidential') {
            // requester may propose; HR reviews
        }

        $row = ProfileChangeRequest::create([
            'tenant_id' => $request->user()->tenant_id,
            'person_id' => $person->id,
            'user_id' => $request->user()->id,
            'requested_by' => $request->user()->id,
            'field_group' => $data['field_group'],
            'proposed_changes' => $data['proposed_changes'],
            'requested_changes' => $data['proposed_changes'],
            'status' => 'pending',
        ]);

        $this->notifyPrivacySafe($request->user(), 'people.profile_change_requested', 'A profile change was requested.');

        return response()->json(['data' => $row], 201);
    }

    // ── Organisation ─────────────────────────────────────────────────────────

    public function unitsIndex(Request $request): JsonResponse
    {
        $rows = OrganisationalUnit::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('name')
            ->paginate($request->integer('per_page', 100));

        return response()->json($rows);
    }

    public function unitsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'unit_type' => ['nullable', 'string', 'max:64'],
            'parent_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:32'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
        ]);

        $unit = OrganisationalUnit::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
            'status' => $data['status'] ?? 'active',
            'unit_type' => $data['unit_type'] ?? 'department',
        ]));

        OrganisationalUnitVersion::create([
            'tenant_id' => $unit->tenant_id,
            'organisational_unit_id' => $unit->id,
            'version' => 1,
            'snapshot' => $unit->toArray(),
            'effective_from' => $unit->effective_from,
            'effective_to' => $unit->effective_to,
            'created_by' => $request->user()->id,
        ]);

        $this->audit->record($request->user(), 'org.unit.created', null, OrganisationalUnit::class, $unit->id);

        return response()->json(['data' => $unit], 201);
    }

    public function orgChart(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $units = OrganisationalUnit::query()->where('tenant_id', $tenantId)->where('status', 'active')->get();
        $positions = Position::query()->where('tenant_id', $tenantId)->where(function ($q) {
            $q->where('is_active', true)->orWhere('status', 'active');
        })->get(['id', 'title', 'department_id', 'organisational_unit_id', 'reports_to_position_id', 'code', 'status']);
        $assignments = PositionAssignment::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->get();
        $people = Person::query()
            ->where('tenant_id', $tenantId)
            ->where('directory_visible', true)
            ->get(['id', 'first_name', 'last_name', 'display_name', 'work_email', 'primary_unit_id']);

        // Never leak confidential HR in org chart
        return response()->json([
            'data' => [
                'units' => $units,
                'positions' => $positions,
                'assignments' => $assignments,
                'people' => $people->map(fn ($p) => $this->confidential->directoryPayload($p)),
                'reporting' => ReportingRelationship::query()
                    ->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->get(),
            ],
        ]);
    }

    public function positionsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'department_id' => ['nullable', 'integer'],
            'organisational_unit_id' => ['nullable', 'integer'],
            'code' => ['nullable', 'string', 'max:64'],
            'grade' => ['nullable', 'string', 'max:32'],
            'description' => ['nullable', 'string'],
            'headcount' => ['nullable', 'integer', 'min:1'],
            'is_sg_role' => ['nullable', 'boolean'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
        ]);

        $position = Position::create([
            'tenant_id' => $request->user()->tenant_id,
            'department_id' => $data['department_id'] ?? $this->fallbackDepartmentId($request->user()),
            'organisational_unit_id' => $data['organisational_unit_id'] ?? null,
            'title' => $data['title'],
            'code' => $data['code'] ?? null,
            'grade' => $data['grade'] ?? null,
            'description' => $data['description'] ?? null,
            'headcount' => $data['headcount'] ?? 1,
            'is_active' => true,
            'status' => 'active',
            'is_sg_role' => $data['is_sg_role'] ?? false,
            'effective_from' => $data['effective_from'] ?? null,
            'effective_to' => $data['effective_to'] ?? null,
        ]);

        PositionVersion::create([
            'tenant_id' => $position->tenant_id,
            'position_id' => $position->id,
            'version' => 1,
            'snapshot' => $position->toArray(),
            'effective_from' => $position->effective_from,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $position], 201);
    }

    public function positionsIndex(Request $request): JsonResponse
    {
        $rows = Position::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('title')
            ->paginate($request->integer('per_page', 100));

        return response()->json($rows);
    }

    public function positionAssign(Request $request, Position $position): JsonResponse
    {
        $this->assertTenant($request, $position->tenant_id);
        $data = $request->validate([
            'person_id' => ['required', 'integer'],
            'assignment_type' => ['required', 'in:substantive,acting,temporary'],
            'start_at' => ['required', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'reason' => ['nullable', 'string'],
        ]);

        $isSubstantive = $data['assignment_type'] === 'substantive';
        if ($isSubstantive) {
            $overlap = PositionAssignment::query()
                ->where('position_id', $position->id)
                ->where('status', 'active')
                ->where('is_substantive', true)
                ->whereDate('start_at', '<=', $data['end_at'] ?? '9999-12-31')
                ->where(function ($q) use ($data) {
                    $q->whereNull('end_at')->orWhereDate('end_at', '>=', $data['start_at']);
                })
                ->exists();
            if ($overlap) {
                throw ValidationException::withMessages([
                    'assignment_type' => ['Overlapping substantive assignment is not allowed without explicit approval workflow.'],
                ]);
            }
        }

        $row = PositionAssignment::create([
            'tenant_id' => $request->user()->tenant_id,
            'position_id' => $position->id,
            'person_id' => $data['person_id'],
            'assignment_type' => $data['assignment_type'],
            'is_substantive' => $isSubstantive,
            'start_at' => $data['start_at'],
            'end_at' => $data['end_at'] ?? null,
            'status' => 'active',
            'reason' => $data['reason'] ?? null,
            'created_by' => $request->user()->id,
            'approved_by' => $request->user()->id,
        ]);

        $this->audit->record($request->user(), 'position.assigned', $data['person_id'], PositionAssignment::class, $row->id);

        return response()->json(['data' => $row], 201);
    }

    public function positionVacate(Request $request, Position $position): JsonResponse
    {
        $this->assertTenant($request, $position->tenant_id);
        $data = $request->validate([
            'person_id' => ['required', 'integer'],
            'end_at' => ['nullable', 'date'],
        ]);

        $updated = PositionAssignment::query()
            ->where('position_id', $position->id)
            ->where('person_id', $data['person_id'])
            ->where('status', 'active')
            ->update([
                'status' => 'ended',
                'end_at' => $data['end_at'] ?? now()->toDateString(),
            ]);

        return response()->json(['data' => ['ended' => $updated]]);
    }

    public function reportingStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subordinate_position_id' => ['required', 'integer'],
            'supervisor_position_id' => ['required', 'integer'],
            'relationship_type' => ['nullable', 'string', 'max:32'],
            'is_primary' => ['nullable', 'boolean'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date'],
        ]);

        $this->reporting->assertAcyclic(
            $request->user()->tenant_id,
            (int) $data['subordinate_position_id'],
            (int) $data['supervisor_position_id']
        );

        $row = ReportingRelationship::create([
            'tenant_id' => $request->user()->tenant_id,
            'subordinate_position_id' => $data['subordinate_position_id'],
            'supervisor_position_id' => $data['supervisor_position_id'],
            'relationship_type' => $data['relationship_type'] ?? 'line',
            'is_primary' => $data['is_primary'] ?? true,
            'effective_from' => $data['effective_from'],
            'effective_to' => $data['effective_to'] ?? null,
            'status' => 'active',
            'approved_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $row], 201);
    }

    // ── Job descriptions ─────────────────────────────────────────────────────

    public function jobDescriptionsIndex(Request $request): JsonResponse
    {
        return response()->json(
            JobDescription::query()->where('tenant_id', $request->user()->tenant_id)->paginate(50)
        );
    }

    public function jobDescriptionsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'position_id' => ['required', 'integer'],
            'title' => ['required', 'string'],
            'content' => ['nullable', 'string'],
            'duties' => ['nullable', 'array'],
            'requirements' => ['nullable', 'array'],
        ]);

        $jd = JobDescription::create([
            'tenant_id' => $request->user()->tenant_id,
            'position_id' => $data['position_id'],
            'title' => $data['title'],
            'status' => 'pending_ack',
            'current_version' => 1,
            'created_by' => $request->user()->id,
        ]);

        JobDescriptionVersion::create([
            'tenant_id' => $jd->tenant_id,
            'job_description_id' => $jd->id,
            'version' => 1,
            'content' => $data['content'] ?? null,
            'duties' => $data['duties'] ?? null,
            'requirements' => $data['requirements'] ?? null,
            'published_by' => $request->user()->id,
            'published_at' => now(),
        ]);

        return response()->json(['data' => $jd], 201);
    }

    public function jobDescriptionAcknowledge(Request $request, JobDescription $jobDescription): JsonResponse
    {
        $this->assertTenant($request, $jobDescription->tenant_id);
        $data = $request->validate(['as' => ['required', 'in:sg,employee']]);
        $ver = JobDescriptionVersion::query()
            ->where('job_description_id', $jobDescription->id)
            ->where('version', $jobDescription->current_version)
            ->firstOrFail();

        if ($data['as'] === 'sg') {
            $ver->update(['sg_acknowledged_by' => $request->user()->id, 'sg_acknowledged_at' => now()]);
        } else {
            $ver->update(['employee_acknowledged_by' => $request->user()->id, 'employee_acknowledged_at' => now()]);
        }

        if ($ver->sg_acknowledged_at && $ver->employee_acknowledged_at) {
            $jobDescription->update(['status' => 'active']);
        }

        return response()->json(['data' => $ver->fresh()]);
    }

    // ── Roles ────────────────────────────────────────────────────────────────

    public function rolesIndex(Request $request): JsonResponse
    {
        $manager = app(CanonicalRoleManager::class);

        return response()->json([
            'data' => \Spatie\Permission\Models\Role::query()
                ->where('guard_name', 'sanctum')
                ->whereIn('name', array_merge($manager->canonicalRoleNames(), CanonicalRoleManager::SYSTEM_ROLES))
                ->orderBy('name')
                ->get(['id', 'name', 'guard_name']),
        ]);
    }

    public function userRolesStore(Request $request, User $user): JsonResponse
    {
        $this->assertTenant($request, $user->tenant_id);
        $data = $request->validate([
            'role_name' => ['required', 'string'],
            'is_privileged' => ['nullable', 'boolean'],
            'scope_type' => ['nullable', 'string'],
            'scope_id' => ['nullable', 'integer'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
            'reason' => ['nullable', 'string'],
        ]);

        $roleManager = app(CanonicalRoleManager::class);
        $data['role_name'] = $roleManager->canonicalize($data['role_name']);
        if (! $roleManager->isAssignableRole($data['role_name'])) {
            throw ValidationException::withMessages([
                'role_name' => ['The selected role is not part of the governed role catalogue.'],
            ]);
        }

        $privileged = (bool) ($data['is_privileged'] ?? $this->isPrivilegedRole($data['role_name']));
        if ($privileged && (int) $request->user()->id === (int) $user->id) {
            throw ValidationException::withMessages([
                'role_name' => ['A user cannot approve or grant themselves a privileged role.'],
            ]);
        }

        $row = UserRoleAssignment::create([
            'tenant_id' => $request->user()->tenant_id,
            'user_id' => $user->id,
            'person_id' => $this->authority->resolvePersonId($user),
            'role_name' => $data['role_name'],
            'scope_type' => $data['scope_type'] ?? 'tenant',
            'scope_id' => $data['scope_id'] ?? null,
            'is_privileged' => $privileged,
            'status' => $privileged ? 'pending' : 'active',
            'effective_from' => $data['effective_from'] ?? now()->toDateString(),
            'effective_to' => $data['effective_to'] ?? null,
            'requested_by' => $request->user()->id,
            'reason' => $data['reason'] ?? null,
            'approved_by' => $privileged ? null : $request->user()->id,
            'approved_at' => $privileged ? null : now(),
        ]);

        if (! $privileged) {
            $user->assignRole($data['role_name']);
        }

        return response()->json(['data' => $row], 201);
    }

    public function userRolesApprove(Request $request, UserRoleAssignment $userRole): JsonResponse
    {
        $this->assertTenant($request, $userRole->tenant_id);
        if ((int) $request->user()->id === (int) $userRole->user_id) {
            throw ValidationException::withMessages([
                'role' => ['A user cannot approve their own privileged role.'],
            ]);
        }

        $userRole->update([
            'status' => 'active',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);
        User::find($userRole->user_id)?->assignRole($userRole->role_name);

        return response()->json(['data' => $userRole->fresh()]);
    }

    public function userRolesRevoke(Request $request, UserRoleAssignment $userRole): JsonResponse
    {
        $this->assertTenant($request, $userRole->tenant_id);
        $userRole->update([
            'status' => 'revoked',
            'revoked_by' => $request->user()->id,
            'revoked_at' => now(),
        ]);
        User::find($userRole->user_id)?->removeRole($userRole->role_name);

        return response()->json(['data' => $userRole->fresh()]);
    }

    // ── Authority ────────────────────────────────────────────────────────────

    public function authoritiesIndex(Request $request): JsonResponse
    {
        return response()->json(
            AuthorityDefinition::query()->where('tenant_id', $request->user()->tenant_id)->paginate(100)
        );
    }

    public function authoritiesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string'],
            'module' => ['nullable', 'string'],
            'action' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'is_signing' => ['nullable', 'boolean'],
            'is_contract_signing' => ['nullable', 'boolean'],
            'allows_acting' => ['nullable', 'boolean'],
            'allows_delegation' => ['nullable', 'boolean'],
        ]);

        // Sysadmin cannot assign themselves business authority via this path without SoD
        if ($this->isTechnicalOnly($request->user()) && ($data['is_signing'] ?? false)) {
            throw ValidationException::withMessages([
                'is_signing' => ['System Administrator cannot grant themselves signing authority.'],
            ]);
        }

        $row = AuthorityDefinition::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'is_active' => true,
        ]));

        return response()->json(['data' => $row], 201);
    }

    public function authorityAssignmentsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'authority_definition_id' => ['required', 'integer'],
            'assignee_type' => ['required', 'in:Position,Person,ActingAppointment,Delegation'],
            'assignee_id' => ['required', 'integer'],
            'scope' => ['nullable', 'array'],
            'value_limit' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string', 'max:8'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date'],
        ]);

        $def = AuthorityDefinition::findOrFail($data['authority_definition_id']);
        if ($def->is_signing && (int) $request->user()->id === (int) ($data['assignee_id'] ?? 0) && $data['assignee_type'] === 'Person') {
            $personId = $this->authority->resolvePersonId($request->user());
            if ($personId && (int) $personId === (int) $data['assignee_id']) {
                throw ValidationException::withMessages([
                    'assignee_id' => ['A user cannot grant themselves signing authority.'],
                ]);
            }
        }

        $row = AuthorityAssignment::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'approved_by' => $request->user()->id,
            'status' => 'active',
        ]));

        return response()->json(['data' => $row], 201);
    }

    public function authorityCheck(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'string'],
            'module' => ['nullable', 'string'],
            'record_type' => ['nullable', 'string'],
            'department_id' => ['nullable', 'integer'],
            'amount' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string'],
            'requester_user_id' => ['nullable', 'integer'],
            'requester_person_id' => ['nullable', 'integer'],
            'date' => ['nullable', 'date'],
            'require_contract_signing' => ['nullable', 'boolean'],
            'context_type' => ['nullable', 'string'],
            'context_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $this->authority->check($request->user(), $data)]);
    }

    // ── Acting ───────────────────────────────────────────────────────────────

    public function actingStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'position_id' => ['required', 'integer'],
            'person_id' => ['required', 'integer'],
            'substantive_person_id' => ['nullable', 'integer'],
            'start_at' => ['required', 'date'],
            'end_at' => ['nullable', 'date'],
            'reason' => ['nullable', 'string'],
            'grants_allowance' => ['nullable', 'boolean'],
            'is_acting_sg' => ['nullable', 'boolean'],
        ]);

        $position = Position::findOrFail($data['position_id']);
        $isSg = (bool) ($data['is_acting_sg'] ?? ($position->is_sg_role ?? false));

        $row = ActingAppointment::create([
            'tenant_id' => $request->user()->tenant_id,
            'reference' => 'ACT-'.strtoupper(substr(uniqid(), -6)),
            'position_id' => $data['position_id'],
            'person_id' => $data['person_id'],
            'substantive_person_id' => $data['substantive_person_id'] ?? null,
            'is_acting_sg' => $isSg,
            'grants_allowance' => (bool) ($data['grants_allowance'] ?? false),
            'start_at' => $data['start_at'],
            'end_at' => $data['end_at'] ?? null,
            'status' => 'pending',
            'reason' => $data['reason'] ?? null,
            'requested_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function actingApprove(Request $request, ActingAppointment $actingAppointment): JsonResponse
    {
        $this->assertTenant($request, $actingAppointment->tenant_id);
        $actingAppointment->update([
            'status' => 'active',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        // Create temporary position assignment; does NOT auto-create allowance
        PositionAssignment::create([
            'tenant_id' => $actingAppointment->tenant_id,
            'position_id' => $actingAppointment->position_id,
            'person_id' => $actingAppointment->person_id,
            'assignment_type' => 'acting',
            'is_substantive' => false,
            'start_at' => $actingAppointment->start_at,
            'end_at' => $actingAppointment->end_at,
            'status' => 'active',
            'reason' => 'Acting appointment '.$actingAppointment->reference,
            'created_by' => $request->user()->id,
            'approved_by' => $request->user()->id,
        ]);

        $this->notifyPrivacySafe($request->user(), 'people.acting_approved', 'An acting appointment was approved.');

        return response()->json(['data' => $actingAppointment->fresh()]);
    }

    public function actingIndex(Request $request): JsonResponse
    {
        return response()->json(
            ActingAppointment::query()->where('tenant_id', $request->user()->tenant_id)->latest('id')->paginate(50)
        );
    }

    // ── Delegations ──────────────────────────────────────────────────────────

    public function delegationsIndex(Request $request): JsonResponse
    {
        return response()->json(
            IdentityDelegation::query()->where('tenant_id', $request->user()->tenant_id)->latest('id')->paginate(50)
        );
    }

    public function delegationsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'principal_person_id' => ['required', 'integer'],
            'delegate_person_id' => ['required', 'integer', 'different:principal_person_id'],
            'principal_user_id' => ['nullable', 'integer'],
            'delegate_user_id' => ['nullable', 'integer'],
            'delegation_type' => ['required', 'in:workflow,approval,signing,preparation,general'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'reason' => ['nullable', 'string'],
            'allows_contract_signing' => ['nullable', 'boolean'],
            'creates_acting_allowance' => ['nullable', 'boolean'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*.module' => ['nullable', 'string'],
            'scopes.*.action' => ['required', 'string'],
            'scopes.*.value_limit' => ['nullable', 'numeric'],
            'scopes.*.currency' => ['nullable', 'string'],
        ]);

        // Short workflow delegation ≠ acting allowance
        if (($data['creates_acting_allowance'] ?? false) && $data['delegation_type'] === 'workflow') {
            throw ValidationException::withMessages([
                'creates_acting_allowance' => ['A short workflow delegation does not automatically create an acting allowance.'],
            ]);
        }

        $row = IdentityDelegation::create([
            'tenant_id' => $request->user()->tenant_id,
            'reference' => 'DEL-'.strtoupper(substr(uniqid(), -6)),
            'principal_person_id' => $data['principal_person_id'],
            'delegate_person_id' => $data['delegate_person_id'],
            'principal_user_id' => $data['principal_user_id'] ?? null,
            'delegate_user_id' => $data['delegate_user_id'] ?? null,
            'delegation_type' => $data['delegation_type'],
            'start_at' => $data['start_at'],
            'end_at' => $data['end_at'],
            'reason' => $data['reason'] ?? null,
            'allows_transitive' => false,
            'allows_contract_signing' => (bool) ($data['allows_contract_signing'] ?? false),
            'creates_acting_allowance' => false,
            'status' => 'pending',
            'created_by' => $request->user()->id,
        ]);

        foreach ($data['scopes'] as $scope) {
            IdentityDelegationScope::create([
                'tenant_id' => $request->user()->tenant_id,
                'identity_delegation_id' => $row->id,
                'module' => $scope['module'] ?? null,
                'action' => $scope['action'],
                'value_limit' => $scope['value_limit'] ?? null,
                'currency' => $scope['currency'] ?? null,
            ]);
        }

        $scopes = IdentityDelegationScope::query()->where('identity_delegation_id', $row->id)->get();

        return response()->json(['data' => array_merge($row->toArray(), ['scopes' => $scopes])], 201);
    }

    public function delegationsApprove(Request $request, IdentityDelegation $delegation): JsonResponse
    {
        $this->assertTenant($request, $delegation->tenant_id);
        $delegation->update([
            'status' => 'active',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
            'activated_at' => now(),
        ]);
        $this->notifyPrivacySafe($request->user(), 'people.delegation_activated', 'A delegation was activated.');

        return response()->json(['data' => $delegation->fresh()]);
    }

    public function delegationsRevoke(Request $request, IdentityDelegation $delegation): JsonResponse
    {
        $this->assertTenant($request, $delegation->tenant_id);
        $data = $request->validate(['revocation_reason' => ['nullable', 'string']]);
        $delegation->update([
            'status' => 'revoked',
            'revoked_at' => now(),
            'revoked_by' => $request->user()->id,
            'revocation_reason' => $data['revocation_reason'] ?? null,
        ]);

        return response()->json(['data' => $delegation->fresh()]);
    }

    // ── Signatures ───────────────────────────────────────────────────────────

    public function signaturesEnrol(Request $request): JsonResponse
    {
        $data = $request->validate([
            'person_id' => ['required', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'enrolment_type' => ['nullable', 'string'],
            'specimen_path' => ['nullable', 'string'],
            'specimen_payload' => ['nullable', 'string'],
            'signature_profile_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => $this->signing->enrol($request->user(), $data)], 201);
    }

    public function signaturesActivate(Request $request, SignatureEnrolment $signature): JsonResponse
    {
        $this->assertTenant($request, $signature->tenant_id);

        return response()->json(['data' => $this->signing->activate($request->user(), $signature)]);
    }

    public function documentsSign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'document_type' => ['required', 'string'],
            'document_id' => ['required'],
            'document_version_id' => ['nullable', 'string'],
            'document_content' => ['nullable', 'string'],
            'document_hash' => ['nullable', 'string'],
            'signature_meaning' => ['required', 'string'],
            'authentication_strength' => ['nullable', 'string'],
            'module' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string'],
            'requester_user_id' => ['nullable', 'integer'],
            'require_contract_signing' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->signing->sign($request->user(), $data)], 201);
    }

    public function documentsSignatures(Request $request): JsonResponse
    {
        $data = $request->validate([
            'document_type' => ['required', 'string'],
            'document_id' => ['required'],
        ]);

        $rows = DocumentSignatureEvent::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('document_type', $data['document_type'])
            ->where('document_id', $data['document_id'])
            ->orderBy('signed_at')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function signaturesSuspend(Request $request, SignatureEnrolment $signature): JsonResponse
    {
        $this->assertTenant($request, $signature->tenant_id);
        $signature->update(['status' => 'suspended', 'suspended_at' => now()]);

        return response()->json(['data' => $signature->fresh()]);
    }

    public function signaturesRevoke(Request $request, SignatureEnrolment $signature): JsonResponse
    {
        $this->assertTenant($request, $signature->tenant_id);
        $signature->update(['status' => 'revoked', 'revoked_at' => now()]);

        return response()->json(['data' => $signature->fresh()]);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    public function onboardingStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'person_id' => ['nullable', 'integer'],
            'target_position_id' => ['nullable', 'integer'],
            'target_unit_id' => ['nullable', 'integer'],
            'checklist' => ['nullable', 'array'],
        ]);

        $row = OnboardingCase::create([
            'tenant_id' => $request->user()->tenant_id,
            'person_id' => $data['person_id'] ?? null,
            'reference' => 'ONB-'.strtoupper(substr(uniqid(), -6)),
            'status' => 'in_progress',
            'checklist' => $data['checklist'] ?? [
                'create_person' => false,
                'link_account' => false,
                'assign_position' => false,
                'assign_roles' => false,
                'enrol_signature' => false,
            ],
            'target_position_id' => $data['target_position_id'] ?? null,
            'target_unit_id' => $data['target_unit_id'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function offboardingStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'person_id' => ['required', 'integer'],
            'last_working_day' => ['nullable', 'date'],
            'checklist' => ['nullable', 'array'],
            'access_actions_confirmed' => ['nullable', 'boolean'],
            'complete' => ['nullable', 'boolean'],
        ]);

        if (($data['complete'] ?? false) && ! ($data['access_actions_confirmed'] ?? false)) {
            throw ValidationException::withMessages([
                'access_actions_confirmed' => ['Offboarding cannot be closed before required access actions are confirmed.'],
            ]);
        }

        $row = OffboardingCase::create([
            'tenant_id' => $request->user()->tenant_id,
            'person_id' => $data['person_id'],
            'reference' => 'OFF-'.strtoupper(substr(uniqid(), -6)),
            'status' => ($data['complete'] ?? false) ? 'completed' : 'in_progress',
            'checklist' => $data['checklist'] ?? [
                'revoke_roles' => false,
                'revoke_delegations' => false,
                'suspend_signature' => false,
                'disable_account' => false,
            ],
            'access_actions_confirmed' => (bool) ($data['access_actions_confirmed'] ?? false),
            'last_working_day' => $data['last_working_day'] ?? null,
            'created_by' => $request->user()->id,
            'completed_at' => ($data['complete'] ?? false) ? now() : null,
        ]);

        // Disabling account must not erase historical attribution — we never delete person/audit
        return response()->json(['data' => $row], 201);
    }

    public function transfersStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'person_id' => ['required', 'integer'],
            'from_position_id' => ['nullable', 'integer'],
            'to_position_id' => ['nullable', 'integer'],
            'from_unit_id' => ['nullable', 'integer'],
            'to_unit_id' => ['nullable', 'integer'],
            'transfer_type' => ['nullable', 'in:transfer,promotion'],
            'effective_date' => ['nullable', 'date'],
            'reason' => ['nullable', 'string'],
        ]);

        $row = TransferCase::create(array_merge($data, [
            'tenant_id' => $request->user()->tenant_id,
            'transfer_type' => $data['transfer_type'] ?? 'transfer',
            'status' => 'in_progress',
            'created_by' => $request->user()->id,
        ]));

        return response()->json(['data' => $row], 201);
    }

    public function accessReviewsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'due_date' => ['nullable', 'date'],
            'items' => ['nullable', 'array'],
        ]);

        $campaign = AccessReviewCampaign::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $data['name'],
            'status' => 'open',
            'due_date' => $data['due_date'] ?? null,
            'created_by' => $request->user()->id,
            'opened_at' => now(),
        ]);

        foreach ($data['items'] ?? [] as $item) {
            AccessReviewItem::create([
                'tenant_id' => $request->user()->tenant_id,
                'campaign_id' => $campaign->id,
                'user_id' => $item['user_id'] ?? null,
                'person_id' => $item['person_id'] ?? null,
                'review_type' => $item['review_type'] ?? 'role',
                'subject_snapshot' => $item['subject_snapshot'] ?? null,
                'status' => 'pending',
            ]);
        }

        return response()->json(['data' => $campaign], 201);
    }

    public function reports(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $type = $request->query('type', 'directory');

        $data = match ($type) {
            'directory' => Person::query()->where('tenant_id', $tenantId)->where('directory_visible', true)->get()
                ->map(fn ($p) => $this->confidential->directoryPayload($p)),
            'positions' => Position::query()->where('tenant_id', $tenantId)->get(),
            'delegations' => IdentityDelegation::query()->where('tenant_id', $tenantId)->get(),
            'authority' => AuthorityAssignment::query()->where('tenant_id', $tenantId)->with('definition')->get(),
            'signatures' => SignatureEnrolment::query()->where('tenant_id', $tenantId)
                ->get(['id', 'person_id', 'user_id', 'enrolment_type', 'status', 'activated_at', 'suspended_at', 'revoked_at']),
            'org-chart' => $this->orgChart($request)->getData(true)['data'] ?? [],
            default => [],
        };

        return response()->json(['data' => $data, 'type' => $type]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $personId = $this->authority->resolvePersonId($user);
        $person = $personId ? Person::find($personId) : null;

        return response()->json([
            'data' => [
                'user_id' => $user->id,
                'person' => $person ? $this->confidential->directoryPayload($person) : null,
                'roles' => $user->getRoleNames(),
                'active_assignment' => $personId
                    ? PositionAssignment::query()->where('person_id', $personId)->where('status', 'active')->first()
                    : null,
                'delegations' => IdentityDelegation::query()
                    ->where(function ($q) use ($user, $personId) {
                        $q->where('delegate_user_id', $user->id);
                        if ($personId) {
                            $q->orWhere('delegate_person_id', $personId)->orWhere('principal_person_id', $personId);
                        }
                    })
                    ->whereIn('status', ['active', 'approved', 'pending'])
                    ->get(),
                'signature' => $personId
                    ? SignatureEnrolment::query()->where('person_id', $personId)->latest('id')->first()
                    : null,
            ],
        ]);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function assertTenant(Request $request, int $tenantId): void
    {
        if ((int) $request->user()->tenant_id !== (int) $tenantId) {
            abort(404);
        }
    }

    private function linkUser(User $actor, int $personId, int $userId, string $linkType = 'primary'): PersonUserLink
    {
        $target = User::where('tenant_id', $actor->tenant_id)->findOrFail($userId);

        return PersonUserLink::updateOrCreate(
            ['person_id' => $personId, 'user_id' => $target->id],
            [
                'tenant_id' => $actor->tenant_id,
                'link_type' => $linkType,
                'status' => 'active',
                'linked_at' => now(),
                'linked_by' => $actor->id,
            ]
        );
    }

    private function fallbackDepartmentId(User $user): int
    {
        $dept = \App\Models\Department::query()->where('tenant_id', $user->tenant_id)->first();
        if ($dept) {
            return $dept->id;
        }

        return \App\Models\Department::create([
            'tenant_id' => $user->tenant_id,
            'name' => 'Secretariat',
            'code' => 'SEC',
        ])->id;
    }

    private function isPrivilegedRole(string $roleName): bool
    {
        return in_array(strtolower($roleName), [
            'system admin', 'super-admin', 'secretary general', 'finance director', 'finance controller',
        ], true);
    }

    private function isTechnicalOnly(User $user): bool
    {
        $roles = $user->getRoleNames()->map(fn ($r) => strtolower((string) $r));

        return $roles->intersect(['system admin', 'super-admin'])->isNotEmpty()
            && $roles->intersect(['secretary general', 'hr manager', 'finance controller'])->isEmpty();
    }

    private function notifyPrivacySafe(User $actor, string $trigger, string $message): void
    {
        // Privacy-safe: no confidential fields in notification body
        try {
            if (class_exists(\App\Services\NotificationService::class)) {
                app(\App\Services\NotificationService::class)->notifyUser(
                    $actor,
                    $trigger,
                    ['message' => $message, 'module' => 'people-authority']
                );
            }
        } catch (\Throwable) {
            // Notifications are best-effort in Phase 1
        }
    }
}
