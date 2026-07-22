<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeArrivalDeparture;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeArrivalDeparturesTest extends TestCase
{
    private function draftProgramme(Tenant $tenant, int $userId): Programme
    {
        return Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $userId,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Arrival Test Programme',
            'status'           => 'draft',
        ]);
    }

    public function test_staff_can_add_an_arrival_departure_row(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/arrival-departures", [
            'category'       => 'participant',
            'arrival_date'   => '2026-08-01',
            'departure_date' => '2026-08-03',
        ])->assertCreated();

        $this->assertDatabaseHas('programme_arrival_departures', [
            'programme_id' => $programme->id,
            'category'     => 'participant',
        ]);
    }

    public function test_departure_before_arrival_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/arrival-departures", [
            'category'       => 'participant',
            'arrival_date'   => '2026-08-03',
            'departure_date' => '2026-08-01',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['departure_date']);
    }

    public function test_malformed_departure_date_returns_validation_error_not_a_server_error(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/arrival-departures", [
            'category'       => 'participant',
            'arrival_date'   => '2026-08-01',
            'departure_date' => 'not-a-date',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['departure_date']);
    }

    public function test_staff_can_delete_an_arrival_departure_row(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $row = ProgrammeArrivalDeparture::create([
            'programme_id' => $programme->id,
            'category'     => 'consultant',
        ]);

        $http->deleteJson("/api/v1/programmes/{$programme->id}/arrival-departures/{$row->id}")->assertOk();
        $this->assertSoftDeleted('programme_arrival_departures', ['id' => $row->id]);
    }

    public function test_partial_update_rejects_departure_before_existing_arrival(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $row = ProgrammeArrivalDeparture::create([
            'programme_id'   => $programme->id,
            'category'       => 'consultant',
            'arrival_date'   => '2026-08-10',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}/arrival-departures/{$row->id}", [
            'departure_date' => '2026-08-05',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['departure_date']);
    }

    public function test_partial_update_allows_departure_after_existing_arrival(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $row = ProgrammeArrivalDeparture::create([
            'programme_id'   => $programme->id,
            'category'       => 'consultant',
            'arrival_date'   => '2026-08-10',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}/arrival-departures/{$row->id}", [
            'departure_date' => '2026-08-15',
        ])->assertOk();

        $this->assertDatabaseHas('programme_arrival_departures', [
            'id'             => $row->id,
            'departure_date' => '2026-08-15',
        ]);
    }
}
