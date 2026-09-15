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

    public function test_admin_can_delete_system_event_type(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $type = WorkplanEventType::create([
            'tenant_id' => $tenant->id,
            'name' => 'Meeting',
            'slug' => 'meeting',
            'icon' => 'groups',
            'color' => 'primary',
            'is_system' => true,
            'sort_order' => 1,
        ]);

        $http->deleteJson("/api/v1/workplan/event-types/{$type->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Event type deleted.');

        $this->assertDatabaseMissing('workplan_event_types', ['id' => $type->id]);
    }

    public function test_admin_can_delete_event_type_that_is_in_use(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $type = WorkplanEventType::create([
            'tenant_id' => $tenant->id,
            'name' => 'Workshop',
            'slug' => 'workshop',
            'icon' => 'event',
            'color' => 'neutral',
            'is_system' => false,
            'sort_order' => 6,
        ]);

        WorkplanEvent::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Planning workshop',
            'type' => $type->slug,
            'date' => now()->addDays(5)->toDateString(),
        ]);

        $http->deleteJson("/api/v1/workplan/event-types/{$type->id}")->assertOk();
        $this->assertDatabaseMissing('workplan_event_types', ['id' => $type->id]);
        $this->assertDatabaseHas('workplan_events', ['title' => 'Planning workshop', 'type' => 'workshop']);
    }

    public function test_staff_cannot_delete_event_type(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $type = WorkplanEventType::create([
            'tenant_id' => $tenant->id,
            'name' => 'Workshop',
            'slug' => 'workshop',
            'icon' => 'event',
            'color' => 'neutral',
            'is_system' => false,
            'sort_order' => 6,
        ]);

        $http->deleteJson("/api/v1/workplan/event-types/{$type->id}")->assertForbidden();
        $this->assertDatabaseHas('workplan_event_types', ['id' => $type->id]);
    }

    // ─── Workplan Events ─────────────────────────────────────────────────────

    public function test_staff_can_create_workplan_event(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->postJson('/api/v1/workplan/events', [
            'title'    => 'Annual Budget Planning',
            'type'     => 'conference',
            'date'     => now()->addDays(7)->toDateString(),
            'end_date' => now()->addDays(9)->toDateString(),
        ])->assertCreated();
    }

    public function test_workplan_event_requires_title(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/workplan/events', [
            'date' => now()->addDays(7)->toDateString(),
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
        [$http, $user] = $this->asAdmin($tenant);

        $event = WorkplanEvent::create([
            'tenant_id'  => $tenant->id,
            'created_by' => $user->id,
            'title'      => 'Delete me',
            'type'       => 'meeting',
            'date'       => now()->addDays(5)->toDateString(),
        ]);

        $http->deleteJson("/api/v1/workplan/events/{$event->id}")->assertOk();
        $this->assertSoftDeleted('workplan_events', ['id' => $event->id]);
    }

    public function test_guest_cannot_bulk_delete_workplan_events(): void
    {
        $this->postJson('/api/v1/workplan/events/bulk-delete', [
            'ids' => [1],
        ])->assertUnauthorized();
    }

    public function test_admin_can_bulk_delete_own_tenant_events(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $keep = WorkplanEvent::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Keep me',
            'type' => 'meeting',
            'date' => now()->addDays(2)->toDateString(),
        ]);
        $first = WorkplanEvent::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Delete first',
            'type' => 'deadline',
            'date' => now()->addDays(3)->toDateString(),
        ]);
        $second = WorkplanEvent::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Delete second',
            'type' => 'travel',
            'date' => now()->addDays(4)->toDateString(),
        ]);

        $http->postJson('/api/v1/workplan/events/bulk-delete', [
            'ids' => [$first->id, $second->id, $second->id],
        ])->assertOk()
            ->assertJsonPath('data.deleted_count', 2);

        $this->assertSoftDeleted('workplan_events', ['id' => $first->id]);
        $this->assertSoftDeleted('workplan_events', ['id' => $second->id]);
        $this->assertDatabaseHas('workplan_events', ['id' => $keep->id, 'deleted_at' => null]);
    }

    public function test_bulk_delete_ignores_other_tenant_event_ids(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        [$http, $userA] = $this->asAdmin($tenantA);
        $userB = $this->makeAdmin($tenantB);

        $own = WorkplanEvent::create([
            'tenant_id' => $tenantA->id,
            'created_by' => $userA->id,
            'title' => 'Own event',
            'type' => 'meeting',
            'date' => now()->addDays(2)->toDateString(),
        ]);
        $foreign = WorkplanEvent::create([
            'tenant_id' => $tenantB->id,
            'created_by' => $userB->id,
            'title' => 'Foreign event',
            'type' => 'meeting',
            'date' => now()->addDays(2)->toDateString(),
        ]);

        $http->postJson('/api/v1/workplan/events/bulk-delete', [
            'ids' => [$own->id, $foreign->id],
        ])->assertOk()
            ->assertJsonPath('data.deleted_count', 1);

        $this->assertSoftDeleted('workplan_events', ['id' => $own->id]);
        $this->assertDatabaseHas('workplan_events', ['id' => $foreign->id, 'deleted_at' => null]);
    }

    public function test_bulk_delete_rejects_empty_and_oversized_id_lists(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/workplan/events/bulk-delete', [
            'ids' => [],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);

        $http->postJson('/api/v1/workplan/events/bulk-delete', [
            'ids' => range(1, 501),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);
    }

    public function test_external_endpoint_rejects_unauthenticated_caller(): void
    {
        $this->getJson('/api/v1/external/workplan')->assertUnauthorized();
    }
}
