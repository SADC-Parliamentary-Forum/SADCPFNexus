<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammesTest extends TestCase
{
    private function programmePayload(array $overrides = []): array
    {
        return array_merge([
            'title'       => 'SRHR Advocacy Programme 2026',
            'description' => 'Annual SRHR advocacy and capacity building.',
            'start_date'  => now()->addDays(7)->toDateString(),
            'end_date'    => now()->addMonths(6)->toDateString(),
            'budget'      => 50000.00,
            'currency'    => 'NAD',
        ], $overrides);
    }

    public function test_unauthenticated_cannot_list_programmes(): void
    {
        $this->getJson('/api/v1/programmes')->assertUnauthorized();
    }

    public function test_programme_officer_can_create_programme(): void
    {
        [$http, $user] = $this->asProgrammeOfficer();

        $response = $http->postJson('/api/v1/programmes', $this->programmePayload());

        $response->assertCreated();
        $this->assertDatabaseHas('programmes', [
            'title'      => 'SRHR Advocacy Programme 2026',
            'created_by' => $user->id,
        ]);
    }

    public function test_create_skips_soft_deleted_reference_numbers(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $year = now()->year;

        // Active count would suggest next = 005, but 005 already exists (trashed gap).
        foreach (['001', '002', '004', '005'] as $seq) {
            Programme::create([
                'tenant_id'        => $tenant->id,
                'created_by'       => $user->id,
                'reference_number' => "PIF-{$year}-{$seq}",
                'title'            => "Existing {$seq}",
                'status'           => 'draft',
            ]);
        }

        Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => "PIF-{$year}-003",
            'title'            => 'Soft-deleted 003',
            'status'           => 'draft',
        ])->delete();

        $response = $http->postJson('/api/v1/programmes', ['title' => 'Next After Gap']);

        $response->assertCreated();
        $this->assertSame("PIF-{$year}-006", $response->json('data.reference_number'));
    }

    public function test_programme_requires_title(): void
    {
        [$http] = $this->asProgrammeOfficer();

        $http->postJson('/api/v1/programmes', [
            'description' => 'No title',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_staff_can_list_own_programmes(): void
    {
        [$http] = $this->asProgrammeOfficer();

        $http->getJson('/api/v1/programmes')->assertOk();
    }

    public function test_staff_can_view_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Test Programme',
            'status'           => 'draft',
        ]);

        $http->getJson("/api/v1/programmes/{$programme->id}")->assertOk();
    }

    public function test_programme_json_exposes_responsible_officer_as_a_name_not_a_user_object(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        $programme = Programme::create([
            'tenant_id'              => $tenant->id,
            'created_by'             => $user->id,
            'reference_number'       => 'PIF-' . uniqid(),
            'title'                  => 'Officer collision PIF',
            'status'                 => 'draft',
            'responsible_officer_id' => $user->id,
        ]);

        $payload = app(\App\Modules\Programmes\Services\ProgrammeService::class)
            ->get($programme)
            ->toArray();

        $this->assertIsString($payload['responsible_officer']);
        $this->assertSame($user->name, $payload['responsible_officer']);
        $this->assertIsArray($payload['responsible_officer_user']);
        $this->assertSame($user->id, $payload['responsible_officer_user']['id']);
        $this->assertSame($user->name, $payload['responsible_officer_user']['name']);
    }

    public function test_staff_can_update_draft_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Old Title',
            'status'           => 'draft',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}", [
            'title' => 'Updated Title',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'    => $programme->id,
            'title' => 'Updated Title',
        ]);
    }

    public function test_staff_can_submit_programme_for_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Submit Me',
            'status'           => 'draft',
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/submit", [
            'declaration_confirmed' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'     => $programme->id,
            'status' => 'submitted',
        ]);
    }

    public function test_staff_can_create_a_minimal_draft_with_only_a_title(): void
    {
        [$http] = $this->asProgrammeOfficer();

        $response = $http->postJson('/api/v1/programmes', ['title' => 'Untitled PIF']);

        $response->assertCreated();
        $response->assertJsonPath('data.status', 'draft');
        $this->assertNotNull($response->json('data.id'));
    }

    public function test_new_draft_can_immediately_receive_a_document_row(): void
    {
        [$http] = $this->asProgrammeOfficer();

        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Untitled PIF'])
            ->json('data.id');

        $http->postJson("/api/v1/programmes/{$programmeId}/documents", [
            'title'         => 'Concept Note',
            'document_type' => 'concept_note',
            'owner_name'    => 'Jane Partner',
        ])->assertCreated();
    }

    public function test_admin_can_approve_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $staff->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Approve Me',
            'status'           => 'submitted',
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/approve")
             ->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'     => $programme->id,
            'status' => 'approved',
        ]);
    }

    public function test_approving_a_programme_notifies_the_responsible_officer(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $programme = Programme::create([
            'tenant_id'               => $tenant->id,
            'created_by'              => $staff->id,
            'reference_number'        => 'PIF-' . uniqid(),
            'title'                   => 'Notify Me',
            'status'                  => 'submitted',
            'responsible_officer_id'  => $staff->id,
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/approve")->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $staff->id,
            'trigger' => 'programme.approved_for_me',
        ]);
    }

    public function test_approving_a_programme_notifies_me_officers(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant); // staff already holds mande.create per seeder
        $meOfficer = $this->makeUser('Governance Officer', $tenant); // holds mande.admin per seeder

        $programme = Programme::create([
            'tenant_id'               => $tenant->id,
            'created_by'              => $staff->id,
            'reference_number'        => 'PIF-' . uniqid(),
            'title'                   => 'Notify ME',
            'status'                  => 'submitted',
            'responsible_officer_id'  => $staff->id,
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/approve")->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $meOfficer->id,
            'trigger' => 'programme.me_intake_available',
        ]);
    }

    public function test_approving_a_programme_notifies_all_responsible_officers(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $officerOne = $this->makeUser('staff', $tenant);
        $officerTwo = $this->makeUser('staff', $tenant);

        $programme = Programme::create([
            'tenant_id'               => $tenant->id,
            'created_by'              => $staff->id,
            'reference_number'        => 'PIF-' . uniqid(),
            'title'                   => 'Notify All Officers',
            'status'                  => 'submitted',
            'responsible_officer_id'  => $officerOne->id,
            'responsible_officer_ids' => [$officerOne->id, $officerTwo->id],
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/approve")->assertOk();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $officerOne->id,
            'trigger' => 'programme.approved_for_me',
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $officerTwo->id,
            'trigger' => 'programme.approved_for_me',
        ]);
    }
}
