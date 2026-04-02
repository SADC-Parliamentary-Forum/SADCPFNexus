<?php

namespace Tests\Feature\Calendar;

use App\Models\CalendarEntry;
use App\Models\Tenant;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    public function test_unauthenticated_cannot_list_calendar(): void
    {
        $this->getJson('/api/v1/calendar/entries')->assertUnauthorized();
    }

    public function test_staff_can_list_calendar_entries(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/calendar/entries')->assertOk();
    }

    public function test_admin_can_create_calendar_entry(): void
    {
        [$http, $user] = $this->asAdmin();

        $response = $http->postJson('/api/v1/calendar/entries', [
            'title'    => 'World Health Day',
            'date'     => now()->addDays(30)->toDateString(),
            'type'     => 'un_day',
            'is_alert' => true,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('calendar_entries', [
            'title' => 'World Health Day',
            'type'  => 'un_day',
        ]);
    }

    public function test_calendar_entry_requires_title(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/calendar/entries', [
            'date' => now()->addDays(5)->toDateString(),
            'type' => 'sadc_holiday',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_admin_can_update_calendar_entry(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $entry = CalendarEntry::create([
            'tenant_id' => $tenant->id,
            'title'     => 'Old Title',
            'date'      => now()->addDays(10)->toDateString(),
            'type'      => 'sadc_calendar',
            'is_alert'  => false,
        ]);

        $http->putJson("/api/v1/calendar/entries/{$entry->id}", [
            'title'    => 'Updated Title',
            'is_alert' => true,
        ])->assertOk();

        $this->assertDatabaseHas('calendar_entries', [
            'id'       => $entry->id,
            'title'    => 'Updated Title',
            'is_alert' => true,
        ]);
    }

    public function test_admin_can_delete_calendar_entry(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $entry = CalendarEntry::create([
            'tenant_id' => $tenant->id,
            'title'     => 'Delete this',
            'date'      => now()->addDays(15)->toDateString(),
            'type'      => 'sadc_calendar',
            'is_alert'  => false,
        ]);

        $http->deleteJson("/api/v1/calendar/entries/{$entry->id}")->assertOk();
        $this->assertDatabaseMissing('calendar_entries', ['id' => $entry->id]);
    }
}
