<?php

namespace Tests\Feature\PeopleAuthority;

use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\PersonUserLink;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class PeopleDirectorySupplierExclusionTest extends TestCase
{
    public function test_sync_from_users_excludes_supplier_accounts(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->makeHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $supplier = $this->makeUser('Supplier', $tenant);

        $this->asUser($hr)->postJson('/api/v1/people-authority/people/sync-from-users')
            ->assertOk();

        $this->assertTrue(
            Person::where('tenant_id', $tenant->id)
                ->whereRaw('LOWER(work_email) = ?', [strtolower((string) $staff->email)])
                ->exists()
        );
        $this->assertFalse(
            Person::where('tenant_id', $tenant->id)
                ->whereRaw('LOWER(work_email) = ?', [strtolower((string) $supplier->email)])
                ->exists()
        );
    }

    public function test_remove_supplier_links_soft_deletes_only_supplier_linked_people(): void
    {
        $tenant = Tenant::factory()->create();
        $hr = $this->makeHrManager($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $supplier = $this->makeUser('Supplier', $tenant);

        $staffPerson = $this->linkedPerson($staff, 'Genuine Staff');
        $supplierPerson = $this->linkedPerson($supplier, 'Mistaken Supplier');

        $res = $this->asUser($hr)->postJson('/api/v1/people-authority/people/remove-supplier-links')
            ->assertOk();

        $this->assertSame(1, $res->json('data.removed'));
        $this->assertNotNull(Person::withTrashed()->find($supplierPerson->id)->deleted_at);
        $this->assertNull(Person::find($staffPerson->id)->deleted_at ?? null);
        $this->assertNotNull(Person::find($staffPerson->id));

        $this->assertSame(
            'inactive',
            PersonUserLink::where('person_id', $supplierPerson->id)->where('user_id', $supplier->id)->first()->status
        );
    }

    private function linkedPerson(User $user, string $name): Person
    {
        $person = Person::create([
            'tenant_id' => $user->tenant_id,
            'first_name' => $name,
            'last_name' => 'Test',
            'display_name' => $name,
            'work_email' => $user->email,
            'person_type' => 'employee',
            'employment_status' => 'active',
            'directory_visible' => true,
            'created_by' => $user->id,
        ]);

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
}
