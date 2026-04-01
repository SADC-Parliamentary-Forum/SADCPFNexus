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
            'title'      => 'World Health Day',
            'entry_date' => now()->addDays(30)->toDateString(),
            'entry_type' => 'public_holiday',
            'is_public'  => true,
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('calendar_entries', [
            'title'      => 'World Health Day',
            'entry_type' => 'public_holiday',
        ]);
    }

    public function test_calendar_entry_requires_title(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/calendar/entries', [
            'entry_date' => now()->addDays(5)->toDateString(),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_admin_can_update_calendar_entry(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $entry = CalendarEntry::create([
            'tenant_id'  => $tenant->id,
            'title'      => 'Old Title',
            'entry_date' => now()->addDays(10)->toDateString(),
            'entry_type' => 'observance',
            'is_public'  => false,
        ]);

        $http->putJson("/api/v1/calendar/entries/{$entry->id}", [
            'title'     => 'Updated Title',
            'is_public' => true,
        ])->assertOk();

        $this->assertDatabaseHas('calendar_entries', [
            'id'        => $entry->id,
            'title'     => 'Updated Title',
            'is_public' => true,
        ]);
    }

    public function test_admin_can_delete_calendar_entry(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $entry = CalendarEntry::create([
            'tenant_id'  => $tenant->id,
            'title'      => 'Delete this',
            'entry_date' => now()->addDays(15)->toDateString(),
            'entry_type' => 'observance',
            'is_public'  => false,
        ]);

        $http->deleteJson("/api/v1/calendar/entries/{$entry->id}")->assertOk();
        $this->assertDatabaseMissing('calendar_entries', ['id' => $entry->id]);
    }
}
