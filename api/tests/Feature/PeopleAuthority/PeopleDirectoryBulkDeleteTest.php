<?php

namespace Tests\Feature\PeopleAuthority;

use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\PeopleAuthority\PositionAssignment;
use App\Models\Position;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class PeopleDirectoryBulkDeleteTest extends TestCase
{
    public function test_hr_deletes_several_people_skipping_anyone_who_holds_a_position(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->makeHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $linked = $this->person($tenant, 'Linked', $staff);
        $plain = $this->person($tenant, 'Plain');
        $holder = $this->person($tenant, 'Holder');
        $this->assignPosition($holder, $hr);
        $foreign = $this->person(Tenant::factory()->create(), 'Foreign');

        $this->asUser($hr)->postJson('/api/v1/people-authority/people/bulk-delete', [
            'ids' => [$linked->id, $plain->id, $holder->id, $foreign->id],
        ])
            ->assertOk()
            ->assertJsonPath('data.deleted_count', 2)
            ->assertJsonPath('data.skipped_count', 2)
            ->assertJsonPath('data.skipped.0.reason', 'holds_position')
            ->assertJsonPath('data.skipped.1.reason', 'not_found');

        $this->assertSoftDeleted($linked);
        $this->assertSoftDeleted($plain);
        $this->assertNotSoftDeleted($holder);
        $this->assertNotSoftDeleted($foreign);
        $this->assertSame('inactive', PersonUserLink::where('person_id', $linked->id)->first()->status);
    }

    public function test_deleted_people_leave_the_directory_and_can_be_listed_and_restored(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->makeHrManager($tenant);
        $gone = $this->person($tenant, 'Gone');
        $this->person($tenant, 'Stays');
        $http = $this->asUser($hr);

        $http->postJson('/api/v1/people-authority/people/bulk-delete', ['ids' => [$gone->id]])->assertOk();

        $names = collect($http->getJson('/api/v1/people-authority/people?directory=1')->json('data'))->pluck('first_name');
        $this->assertEquals(['Stays'], $names->all());

        $deleted = $http->getJson('/api/v1/people-authority/people?directory=1&deleted=1')->assertOk()->json('data');
        $this->assertSame([$gone->id], array_column($deleted, 'id'));
        $this->assertNotNull($deleted[0]['deleted_at']);

        $http->postJson('/api/v1/people-authority/people/bulk-restore', ['ids' => [$gone->id]])
            ->assertOk()
            ->assertJsonPath('data.restored_count', 1);
        $this->assertNotSoftDeleted($gone);
    }

    public function test_staff_cannot_delete_people_or_see_deleted_entries(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $person = $this->person($tenant, 'Kept');
        $http = $this->asUser($staff);

        $http->postJson('/api/v1/people-authority/people/bulk-delete', ['ids' => [$person->id]])->assertForbidden();
        $http->postJson('/api/v1/people-authority/people/bulk-restore', ['ids' => [$person->id]])->assertForbidden();
        $http->getJson('/api/v1/people-authority/people?deleted=1')->assertForbidden();
        $this->assertNotSoftDeleted($person);
    }

    public function test_directory_filters_by_status_account_and_case_insensitive_search(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->makeHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $this->person($tenant, 'Amara', $staff);
        $this->person($tenant, 'Bongani', null, 'inactive');
        $http = $this->asUser($hr);

        $names = fn (string $query) => collect($http->getJson('/api/v1/people-authority/people?directory=1&'.$query)->json('data'))
            ->pluck('first_name')->all();

        $this->assertEquals(['Bongani'], $names('status=inactive'));
        $this->assertEquals(['Amara'], $names('account=linked'));
        $this->assertEquals(['Bongani'], $names('account=unlinked'));
        $this->assertEquals(['Amara'], $names('q=AMA'));

        $row = collect($http->getJson('/api/v1/people-authority/people?directory=1&q=amara')->json('data'))->first();
        $this->assertTrue($row['has_account']);
    }

    private function person(Tenant $tenant, string $firstName, ?User $user = null, string $status = 'active'): Person
    {
        $person = Person::create([
            'tenant_id' => $tenant->id,
            'first_name' => $firstName,
            'last_name' => 'Test',
            'display_name' => $firstName.' Test',
            'work_email' => strtolower($firstName).'@example.org',
            'person_type' => 'employee',
            'employment_status' => $status,
            'directory_visible' => true,
        ]);
        if ($user) {
            PersonUserLink::create([
                'tenant_id' => $tenant->id,
                'person_id' => $person->id,
                'user_id' => $user->id,
                'link_type' => 'primary',
                'status' => 'active',
                'linked_at' => now(),
                'linked_by' => $user->id,
            ]);
        }

        return $person;
    }

    private function assignPosition(Person $person, User $hr): void
    {
        $position = Position::create([
            'tenant_id' => $person->tenant_id,
            'department_id' => $this->makeDepartment(Tenant::find($person->tenant_id))->id,
            'title' => 'Director '.uniqid(),
            'code' => 'P'.substr(uniqid(), -5),
            'is_active' => true,
            'status' => 'active',
            'headcount' => 1,
        ]);
        PositionAssignment::create([
            'tenant_id' => $person->tenant_id,
            'position_id' => $position->id,
            'person_id' => $person->id,
            'assignment_type' => 'substantive',
            'is_substantive' => true,
            'start_at' => now()->subDay()->toDateString(),
            'status' => 'active',
            'created_by' => $hr->id,
        ]);
    }
}
