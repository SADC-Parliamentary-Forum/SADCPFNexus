<?php

namespace Tests\Feature\Workplan;

use App\Models\Tenant;
use App\Models\WorkplanEvent;
use App\Models\WorkplanEventType;
use Tests\TestCase;

class WorkplanTest extends TestCase
{
    // ─── Event Types ─────────────────────────────────────────────────────────

    public function test_admin_can_create_event_type(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/workplan/event-types', [
            'name'  => 'Workshop',
            'color' => '#3B82F6',
        ])->assertCreated();
    }

    public function test_staff_cannot_create_event_type(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/workplan/event-types', [
            'name' => 'Workshop',
        ])->assertForbidden();
    }

    public function test_anyone_can_list_event_types(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/workplan/event-types')->assertOk();
    }

    // ─── Workplan Events ─────────────────────────────────────────────────────

    public function test_staff_can_create_workplan_event(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $eventType = WorkplanEventType::create([
            'tenant_id' => $tenant->id,
            'name'      => 'Conference',
        ]);

        $http->postJson('/api/v1/workplan/events', [
            'title'          => 'Annual Budget Planning',
            'event_type_id'  => $eventType->id,
            'start_date'     => now()->addDays(7)->toDateString(),
            'end_date'       => now()->addDays(9)->toDateString(),
        ])->assertCreated();
    }

    public function test_workplan_event_requires_title(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/workplan/events', [
            'start_date' => now()->addDays(7)->toDateString(),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_staff_can_list_workplan_events(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/workplan/events')->assertOk();
    }

    public function test_admin_can_delete_event(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $event = WorkplanEvent::create([
            'tenant_id'  => $tenant->id,
            'title'      => 'Delete me',
            'start_date' => now()->addDays(5)->toDateString(),
            'status'     => 'scheduled',
        ]);

        $http->deleteJson("/api/v1/workplan/events/{$event->id}")->assertOk();
        $this->assertDatabaseMissing('workplan_events', ['id' => $event->id]);
    }

    public function test_external_endpoint_returns_events_unauthenticated(): void
    {
        $this->getJson('/api/v1/external/workplan')->assertOk();
    }
}
