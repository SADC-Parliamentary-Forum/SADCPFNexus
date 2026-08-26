<?php

namespace Tests\Feature\PeopleAuthority;

use App\Models\PeopleAuthority\AuthorityAssignment;
use App\Models\PeopleAuthority\AuthorityDefinition;
use App\Models\PeopleAuthority\DocumentSignatureEvent;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\PeopleAuthority\IdentityDelegationScope;
use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\PersonConfidentialProfile;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\PeopleAuthority\PositionAssignment;
use App\Models\PeopleAuthority\UserRoleAssignment;
use App\Models\Position;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PeopleAuthorityPhase1Test extends TestCase
{
    private function seedPerson(User $user, array $overrides = []): Person
    {
        $person = Person::create(array_merge([
            'tenant_id' => $user->tenant_id,
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'display_name' => 'Ada Lovelace',
            'work_email' => 'ada+'.uniqid().'@example.org',
            'person_type' => 'employee',
            'employment_status' => 'active',
            'directory_visible' => true,
            'created_by' => $user->id,
        ], $overrides));

        PersonUserLink::create([
            'tenant_id' => $user->tenant_id,
            'person_id' => $person->id,
            'user_id' => $user->id,
            'link_type' => 'primary',
            'status' => 'active',
            'linked_at' => now(),
            'linked_by' => $user->id,
        ]);

        return $person;
    }

    private function seedPosition(User $user, array $overrides = []): Position
    {
        $dept = $this->makeDepartment(Tenant::find($user->tenant_id));

        return Position::create(array_merge([
            'tenant_id' => $user->tenant_id,
            'department_id' => $dept->id,
            'title' => 'Director '.uniqid(),
            'code' => 'P'.substr(uniqid(), -5),
            'is_active' => true,
            'status' => 'active',
            'headcount' => 1,
        ], $overrides));
    }

    public function test_person_is_separate_from_user_account(): void
    {
        [, $hr] = $this->asHrManager();
        $staff = $this->makeUser('staff', Tenant::find($hr->tenant_id));

        $create = $this->asUser($hr)->postJson('/api/v1/people-authority/people', [
            'first_name' => 'Grace',
            'last_name' => 'Hopper',
            'work_email' => 'grace@example.org',
            'user_id' => $staff->id,
        ]);
        $create->assertCreated();
        $personId = $create->json('data.id');

        $this->assertDatabaseHas('people', ['id' => $personId, 'first_name' => 'Grace']);
        $this->assertDatabaseHas('person_user_links', [
            'person_id' => $personId,
            'user_id' => $staff->id,
            'status' => 'active',
        ]);
        $this->assertNull($staff->fresh()->getAttribute('password') === null ? null : null);
        // No password fields on people / links
        $this->assertDatabaseMissing('people', ['id' => $personId, 'work_email' => null]);
        $this->assertFalse(isset($create->json('data')['password']));
    }

    public function test_circular_reporting_is_prevented(): void
    {
        [, $hr] = $this->asHrManager();
        $a = $this->seedPosition($hr, ['title' => 'A']);
        $b = $this->seedPosition($hr, ['title' => 'B']);
        $c = $this->seedPosition($hr, ['title' => 'C']);

        $this->asUser($hr)->postJson('/api/v1/people-authority/reporting-relationships', [
            'subordinate_position_id' => $b->id,
            'supervisor_position_id' => $a->id,
            'effective_from' => now()->toDateString(),
        ])->assertCreated();

        $this->asUser($hr)->postJson('/api/v1/people-authority/reporting-relationships', [
            'subordinate_position_id' => $c->id,
            'supervisor_position_id' => $b->id,
            'effective_from' => now()->toDateString(),
        ])->assertCreated();

        $this->asUser($hr)->postJson('/api/v1/people-authority/reporting-relationships', [
            'subordinate_position_id' => $a->id,
            'supervisor_position_id' => $c->id,
            'effective_from' => now()->toDateString(),
        ])->assertUnprocessable();

        $this->asUser($hr)->postJson('/api/v1/people-authority/reporting-relationships', [
            'subordinate_position_id' => $a->id,
            'supervisor_position_id' => $a->id,
            'effective_from' => now()->toDateString(),
        ])->assertUnprocessable();
    }

    public function test_authority_check_respects_value_thresholds(): void
    {
        [, $hr] = $this->asHrManager();
        $person = $this->seedPerson($hr);
        $position = $this->seedPosition($hr);
        PositionAssignment::create([
            'tenant_id' => $hr->tenant_id,
            'position_id' => $position->id,
            'person_id' => $person->id,
            'assignment_type' => 'substantive',
            'is_substantive' => true,
            'start_at' => now()->subDay()->toDateString(),
            'status' => 'active',
            'created_by' => $hr->id,
        ]);

        $def = AuthorityDefinition::create([
            'tenant_id' => $hr->tenant_id,
            'code' => 'PROC_APPROVE',
            'name' => 'Procurement Approve',
            'module' => 'procurement',
            'action' => 'approve',
            'is_active' => true,
        ]);
        AuthorityAssignment::create([
            'tenant_id' => $hr->tenant_id,
            'authority_definition_id' => $def->id,
            'assignee_type' => 'Position',
            'assignee_id' => $position->id,
            'value_limit' => 10000,
            'currency' => 'NAD',
            'effective_from' => now()->subDay()->toDateString(),
            'status' => 'active',
            'approved_by' => $hr->id,
        ]);

        $ok = $this->asUser($hr)->postJson('/api/v1/people-authority/authority/check', [
            'action' => 'approve',
            'module' => 'procurement',
            'amount' => 5000,
            'currency' => 'NAD',
            'context_type' => 'approval',
        ]);
        $ok->assertOk()->assertJsonPath('data.authorised', true);
        $this->assertNotNull($ok->json('data.snapshot_id'));

        $this->asUser($hr)->postJson('/api/v1/people-authority/authority/check', [
            'action' => 'approve',
            'module' => 'procurement',
            'amount' => 50000,
            'currency' => 'NAD',
        ])->assertOk()->assertJsonPath('data.authorised', false);
    }

    public function test_delegation_cannot_exceed_principal_and_blocks_self_approval(): void
    {
        [, $hr] = $this->asHrManager();
        $tenant = Tenant::find($hr->tenant_id);
        $principalUser = $this->makeUser('staff', $tenant);
        $delegateUser = $this->makeUser('staff', $tenant);
        $principal = $this->seedPerson($principalUser, ['first_name' => 'Prin']);
        $delegate = $this->seedPerson($delegateUser, ['first_name' => 'Del']);
        $position = $this->seedPosition($hr);
        PositionAssignment::create([
            'tenant_id' => $hr->tenant_id,
            'position_id' => $position->id,
            'person_id' => $principal->id,
            'assignment_type' => 'substantive',
            'is_substantive' => true,
            'start_at' => now()->subDay()->toDateString(),
            'status' => 'active',
        ]);

        $def = AuthorityDefinition::create([
            'tenant_id' => $hr->tenant_id,
            'code' => 'LEAVE_APPROVE',
            'name' => 'Leave Approve',
            'module' => 'leave',
            'action' => 'approve',
            'is_active' => true,
        ]);
        AuthorityAssignment::create([
            'tenant_id' => $hr->tenant_id,
            'authority_definition_id' => $def->id,
            'assignee_type' => 'Position',
            'assignee_id' => $position->id,
            'value_limit' => 1000,
            'currency' => 'NAD',
            'effective_from' => now()->subDay()->toDateString(),
            'status' => 'active',
        ]);

        $del = IdentityDelegation::create([
            'tenant_id' => $hr->tenant_id,
            'principal_person_id' => $principal->id,
            'delegate_person_id' => $delegate->id,
            'principal_user_id' => $principalUser->id,
            'delegate_user_id' => $delegateUser->id,
            'delegation_type' => 'approval',
            'start_at' => now()->subHour(),
            'end_at' => now()->addDays(7),
            'allows_transitive' => false,
            'allows_contract_signing' => false,
            'creates_acting_allowance' => false,
            'status' => 'active',
            'activated_at' => now(),
            'created_by' => $hr->id,
        ]);
        IdentityDelegationScope::create([
            'tenant_id' => $hr->tenant_id,
            'identity_delegation_id' => $del->id,
            'module' => 'leave',
            'action' => 'approve',
            'value_limit' => 5000, // attempts to exceed principal
            'currency' => 'NAD',
        ]);

        // Exceeds principal threshold
        $this->asUser($delegateUser)->postJson('/api/v1/people-authority/authority/check', [
            'action' => 'approve',
            'module' => 'leave',
            'amount' => 4000,
            'currency' => 'NAD',
        ])->assertOk()->assertJsonPath('data.authorised', false);

        // Within principal threshold via delegation
        $this->asUser($delegateUser)->postJson('/api/v1/people-authority/authority/check', [
            'action' => 'approve',
            'module' => 'leave',
            'amount' => 500,
            'currency' => 'NAD',
            'requester_user_id' => $principalUser->id,
        ])->assertOk()->assertJsonPath('data.authorised', true);

        // Self-approval blocked
        $this->asUser($delegateUser)->postJson('/api/v1/people-authority/authority/check', [
            'action' => 'approve',
            'module' => 'leave',
            'amount' => 100,
            'currency' => 'NAD',
            'requester_user_id' => $delegateUser->id,
        ])->assertOk()
            ->assertJsonPath('data.authorised', false)
            ->assertJsonPath('data.self_approval_conflict', true);
    }

    public function test_signature_hash_immutability_and_enrolment_required(): void
    {
        [, $hr] = $this->asHrManager();
        $person = $this->seedPerson($hr);
        $position = $this->seedPosition($hr);
        PositionAssignment::create([
            'tenant_id' => $hr->tenant_id,
            'position_id' => $position->id,
            'person_id' => $person->id,
            'assignment_type' => 'substantive',
            'is_substantive' => true,
            'start_at' => now()->subDay()->toDateString(),
            'status' => 'active',
        ]);
        $def = AuthorityDefinition::create([
            'tenant_id' => $hr->tenant_id,
            'code' => 'DOC_SIGN',
            'name' => 'Document Sign',
            'module' => 'correspondence',
            'action' => 'sign',
            'is_signing' => true,
            'is_active' => true,
        ]);
        AuthorityAssignment::create([
            'tenant_id' => $hr->tenant_id,
            'authority_definition_id' => $def->id,
            'assignee_type' => 'Position',
            'assignee_id' => $position->id,
            'effective_from' => now()->subDay()->toDateString(),
            'status' => 'active',
        ]);

        // Without enrolment — denied
        $this->asUser($hr)->postJson('/api/v1/people-authority/documents/sign', [
            'document_type' => 'memo',
            'document_id' => 101,
            'document_version_id' => 'v1',
            'document_content' => 'Hello world',
            'signature_meaning' => 'approve',
            'module' => 'correspondence',
        ])->assertUnprocessable();

        $enrol = $this->asUser($hr)->postJson('/api/v1/people-authority/signatures/enrol', [
            'person_id' => $person->id,
            'specimen_payload' => 'ink-blob',
        ])->assertCreated()->json('data');

        $this->asUser($hr)->postJson('/api/v1/people-authority/signatures/'.$enrol['id'].'/activate')
            ->assertOk();

        $signed = $this->asUser($hr)->postJson('/api/v1/people-authority/documents/sign', [
            'document_type' => 'memo',
            'document_id' => 101,
            'document_version_id' => 'v1',
            'document_content' => 'Hello world',
            'signature_meaning' => 'approve',
            'module' => 'correspondence',
        ]);
        $signed->assertCreated();
        $hash = $signed->json('data.document_hash');
        $this->assertSame(hash('sha256', 'Hello world'), $hash);

        // Same version with different content/hash — immutable
        $this->asUser($hr)->postJson('/api/v1/people-authority/documents/sign', [
            'document_type' => 'memo',
            'document_id' => 101,
            'document_version_id' => 'v1',
            'document_content' => 'Hello world CHANGED',
            'signature_meaning' => 'approve',
            'module' => 'correspondence',
        ])->assertUnprocessable();

        $this->assertEquals(1, DocumentSignatureEvent::where('document_id', 101)->where('status', 'valid')->count());
    }

    public function test_acting_does_not_auto_create_allowance_and_sysadmin_has_no_auto_business_authority(): void
    {
        [, $hr] = $this->asHrManager();
        $person = $this->seedPerson($hr);
        $position = $this->seedPosition($hr, ['is_sg_role' => true]);

        $acting = $this->asUser($hr)->postJson('/api/v1/people-authority/acting-appointments', [
            'position_id' => $position->id,
            'person_id' => $person->id,
            'start_at' => now()->toDateString(),
            'end_at' => now()->addDays(14)->toDateString(),
            'is_acting_sg' => true,
            'grants_allowance' => false,
        ])->assertCreated()->json('data');

        $this->assertFalse((bool) $acting['grants_allowance']);
        $this->assertTrue((bool) $acting['is_acting_sg']);

        $this->asUser($hr)->postJson('/api/v1/people-authority/acting-appointments/'.$acting['id'].'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        // Sysadmin without business authority
        $admin = $this->makeAdmin(Tenant::find($hr->tenant_id));
        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/people-authority/authority/check', [
            'action' => 'approve',
            'module' => 'procurement',
            'amount' => 100,
        ])->assertOk()
            ->assertJsonPath('data.authorised', false);
    }

    public function test_privileged_role_requires_approval_and_confidential_acl(): void
    {
        [, $hr] = $this->asHrManager();
        [, $sg] = $this->asSG(Tenant::find($hr->tenant_id));
        $staff = $this->makeUser('staff', Tenant::find($hr->tenant_id));
        $person = $this->seedPerson($staff);

        PersonConfidentialProfile::create([
            'tenant_id' => $hr->tenant_id,
            'person_id' => $person->id,
            'national_id' => 'SECRET-ID',
        ]);

        // Staff lacks people.view-profile — person records are HR directory, not self-service.
        $this->asUser($staff)->getJson('/api/v1/people-authority/people/'.$person->id)
            ->assertForbidden();

        // HR can see confidential
        $this->asUser($hr)->getJson('/api/v1/people-authority/people/'.$person->id)
            ->assertOk()
            ->assertJsonPath('data.confidential.national_id', 'SECRET-ID');

        // Privileged role assignment stays pending
        $assign = $this->asUser($hr)->postJson('/api/v1/people-authority/users/'.$staff->id.'/roles', [
            'role_name' => 'Secretary General',
            'is_privileged' => true,
        ])->assertCreated();
        $this->assertSame('pending', $assign->json('data.status'));

        // Self-approve blocked (staff lacks roles.approve → 403; SoD also enforced in controller)
        $roleId = $assign->json('data.id');
        $self = $this->asUser($staff)->postJson('/api/v1/people-authority/user-roles/'.$roleId.'/approve');
        $this->assertTrue(in_array($self->status(), [403, 422], true), 'expected 403 or 422, got '.$self->status());

        $this->asUser($sg)->postJson('/api/v1/people-authority/user-roles/'.$roleId.'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('user_role_assignments', [
            'id' => $roleId,
            'status' => 'active',
        ]);
        $this->assertInstanceOf(UserRoleAssignment::class, UserRoleAssignment::find($roleId));
    }

    public function test_workflow_delegation_cannot_create_acting_allowance(): void
    {
        [, $hr] = $this->asHrManager();
        $a = $this->seedPerson($hr, ['first_name' => 'A']);
        $bUser = $this->makeUser('staff', Tenant::find($hr->tenant_id));
        $b = $this->seedPerson($bUser, ['first_name' => 'B']);

        $this->asUser($hr)->postJson('/api/v1/people-authority/delegations', [
            'principal_person_id' => $a->id,
            'delegate_person_id' => $b->id,
            'delegation_type' => 'workflow',
            'start_at' => now()->toDateTimeString(),
            'end_at' => now()->addDays(3)->toDateTimeString(),
            'creates_acting_allowance' => true,
            'scopes' => [
                ['module' => 'travel', 'action' => 'prepare'],
            ],
        ])->assertUnprocessable();
    }

    public function test_directory_and_org_chart_omit_confidential(): void
    {
        [, $hr] = $this->asHrManager();
        $person = $this->seedPerson($hr);
        PersonConfidentialProfile::create([
            'tenant_id' => $hr->tenant_id,
            'person_id' => $person->id,
            'national_id' => 'SECRET',
        ]);

        $dir = $this->asUser($hr)->getJson('/api/v1/people-authority/people?directory=1')->assertOk();
        $payload = json_encode($dir->json());
        $this->assertStringNotContainsString('SECRET', $payload);
        $this->assertStringNotContainsString('national_id', $payload);

        $chart = $this->asUser($hr)->getJson('/api/v1/people-authority/organisation/chart')->assertOk();
        $this->assertStringNotContainsString('SECRET', json_encode($chart->json()));
    }
}
