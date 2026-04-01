<?php

namespace Tests\Feature\HR;

use App\Models\HrIncident;
use App\Models\Tenant;
use Tests\TestCase;

class HrIncidentTest extends TestCase
{
    public function test_unauthenticated_cannot_list_incidents(): void
    {
        $this->getJson('/api/v1/hr/incidents')->assertUnauthorized();
    }

    public function test_staff_can_report_incident(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/hr/incidents', [
            'subject'     => 'Workplace safety issue',
            'description' => 'Slippery floor near server room.',
            'severity'    => 'high',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('hr_incidents', [
            'reported_by' => $user->id,
            'status'      => 'reported',
            'severity'    => 'high',
        ]);
    }

    public function test_hr_admin_can_update_incident_status(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $incident = HrIncident::create([
            'tenant_id'        => $tenant->id,
            'reported_by'      => $staff->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject'          => 'Test incident',
            'severity'         => 'medium',
            'status'           => 'reported',
        ]);

        $http->putJson("/api/v1/hr/incidents/{$incident->id}", [
            'status' => 'investigating',
        ])->assertOk();

        $this->assertDatabaseHas('hr_incidents', [
            'id'     => $incident->id,
            'status' => 'investigating',
        ]);
    }

    public function test_staff_cannot_change_incident_status(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $incident = HrIncident::create([
            'tenant_id'        => $tenant->id,
            'reported_by'      => $user->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject'          => 'My incident',
            'severity'         => 'low',
            'status'           => 'reported',
        ]);

        // staff can update description but not status
        $http->putJson("/api/v1/hr/incidents/{$incident->id}", [
            'description' => 'More detail added.',
        ])->assertOk();

        // Verify status field was not accepted (not in staff rules)
        $this->assertDatabaseHas('hr_incidents', [
            'id'     => $incident->id,
            'status' => 'reported',
        ]);
    }

    public function test_hr_admin_can_delete_incident(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $incident = HrIncident::create([
            'tenant_id'        => $tenant->id,
            'reported_by'      => $staff->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject'          => 'To be deleted',
            'severity'         => 'low',
            'status'           => 'reported',
        ]);

        $http->deleteJson("/api/v1/hr/incidents/{$incident->id}")->assertOk();
        $this->assertDatabaseMissing('hr_incidents', ['id' => $incident->id]);
    }

    public function test_staff_cannot_delete_incident(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $incident = HrIncident::create([
            'tenant_id'        => $tenant->id,
            'reported_by'      => $user->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject'          => 'Mine',
            'severity'         => 'low',
            'status'           => 'reported',
        ]);

        $http->deleteJson("/api/v1/hr/incidents/{$incident->id}")->assertForbidden();
    }

    public function test_cross_tenant_access_is_denied(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$http] = $this->asStaff($tenantA);
        $staffB = $this->makeUser('staff', $tenantB);

        $incident = HrIncident::create([
            'tenant_id'        => $tenantB->id,
            'reported_by'      => $staffB->id,
            'reference_number' => HrIncident::generateReferenceNumber(),
            'subject'          => 'Other tenant',
            'severity'         => 'low',
            'status'           => 'reported',
        ]);

        $http->getJson("/api/v1/hr/incidents/{$incident->id}")->assertForbidden();
    }
}
