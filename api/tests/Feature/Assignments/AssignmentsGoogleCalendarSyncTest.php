<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\Tenant;
use App\Modules\Assignments\Services\AssignmentGoogleCalendarSyncService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AssignmentsGoogleCalendarSyncTest extends TestCase
{
    public function test_credentials_absent_degrades_gracefully(): void
    {
        config([
            'services.google.calendar_client_id' => null,
            'services.google.calendar_client_secret' => null,
            'services.google.calendar_refresh_token' => null,
            'services.google.calendar_service_account_json' => null,
        ]);

        $result = app(AssignmentGoogleCalendarSyncService::class)->sync(['dry_run' => true]);

        $this->assertSame('not_configured', $result['status']);
        $this->assertSame(0, $result['pushed']);
        $this->assertSame(0, $result['pulled']);
    }

    public function test_push_assignment_creates_google_event_idempotently(): void
    {
        config([
            'services.google.calendar_client_id' => 'cid',
            'services.google.calendar_client_secret' => 'csecret',
            'services.google.calendar_refresh_token' => 'refresh-token',
            'services.google.calendar_id' => 'primary',
        ]);

        Http::fake([
            'oauth2.googleapis.com/*' => Http::response(['access_token' => 'atok', 'expires_in' => 3600], 200),
            'www.googleapis.com/calendar/v3/calendars/*/events' => Http::response([
                'id' => 'gcal-event-1',
                'etag' => '"etag1"',
                'status' => 'confirmed',
            ], 200),
            'www.googleapis.com/calendar/v3/calendars/*/events/*' => Http::response([
                'id' => 'gcal-event-1',
                'etag' => '"etag2"',
                'status' => 'confirmed',
            ], 200),
        ]);

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $assignment = Assignment::create([
            'tenant_id' => $tenant->id,
            'created_by' => $admin->id,
            'assigned_to' => $admin->id,
            'due_date' => now()->addDays(3)->toDateString(),
            'start_date' => now()->addDays(2)->toDateString(),
            'title' => 'Sync me',
            'description' => 'Google sync push test',
            'status' => 'active',
            'priority' => 'medium',
            'is_template' => false,
        ]);

        $service = app(AssignmentGoogleCalendarSyncService::class);
        $eventId = $service->pushAssignment($assignment->fresh());
        $this->assertSame('gcal-event-1', $eventId);
        $this->assertSame('gcal-event-1', $assignment->fresh()->google_calendar_event_id);

        // Second push updates existing event (idempotent).
        $eventId2 = $service->pushAssignment($assignment->fresh());
        $this->assertSame('gcal-event-1', $eventId2);
    }

    public function test_pull_updates_linked_assignment_schedule_only(): void
    {
        config([
            'services.google.calendar_client_id' => 'cid',
            'services.google.calendar_client_secret' => 'csecret',
            'services.google.calendar_refresh_token' => 'refresh-token',
            'services.google.calendar_id' => 'primary',
        ]);

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $assignment = Assignment::create([
            'tenant_id' => $tenant->id,
            'created_by' => $admin->id,
            'assigned_to' => $admin->id,
            'due_date' => now()->addDays(5)->toDateString(),
            'start_date' => now()->addDays(4)->toDateString(),
            'title' => 'Linked',
            'description' => 'Google sync pull test',
            'status' => 'active',
            'priority' => 'medium',
            'is_template' => false,
            'google_calendar_event_id' => 'gcal-linked-1',
        ]);

        Http::fake([
            'oauth2.googleapis.com/*' => Http::response(['access_token' => 'atok', 'expires_in' => 3600], 200),
            'www.googleapis.com/calendar/v3/calendars/*/events*' => Http::response([
                'items' => [[
                    'id' => 'gcal-linked-1',
                    'etag' => '"etag-new"',
                    'status' => 'confirmed',
                    'start' => ['date' => now()->addDays(6)->toDateString()],
                    'end' => ['date' => now()->addDays(7)->toDateString()],
                ], [
                    'id' => 'unlinked-personal-event',
                    'status' => 'confirmed',
                    'start' => ['date' => now()->addDays(10)->toDateString()],
                    'end' => ['date' => now()->addDays(11)->toDateString()],
                    'summary' => 'Personal dentist',
                ]],
                'nextSyncToken' => 'sync-token-1',
            ], 200),
        ]);

        $result = app(AssignmentGoogleCalendarSyncService::class)->pullEvents($tenant->id);

        $this->assertSame(1, $result['pulled']);
        $this->assertSame(1, $result['skipped']);
        $fresh = $assignment->fresh();
        $this->assertSame(now()->addDays(6)->toDateString(), $fresh->start_date->toDateString());
        $this->assertSame(now()->addDays(7)->toDateString(), $fresh->due_date->toDateString());
        $this->assertDatabaseMissing('assignments', [
            'title' => 'Personal dentist',
            'tenant_id' => $tenant->id,
        ]);
    }

    public function test_sync_command_reports_not_configured(): void
    {
        config([
            'services.google.calendar_client_id' => null,
            'services.google.calendar_client_secret' => null,
        ]);

        $this->artisan('assignments:sync-google-calendar')
            ->assertSuccessful();
    }

    public function test_webhook_rejects_when_secret_absent(): void
    {
        config(['services.google.calendar_webhook_secret' => null]);

        $this->postJson('/api/v1/assignments/google-calendar/webhook', [])
            ->assertUnauthorized();
    }

    public function test_webhook_accepts_valid_token_and_is_idempotent(): void
    {
        config([
            'services.google.calendar_webhook_secret' => 'whsec',
            'services.google.calendar_client_id' => 'cid',
            'services.google.calendar_client_secret' => 'csecret',
            'services.google.calendar_refresh_token' => 'refresh-token',
            'services.google.calendar_id' => 'primary',
        ]);

        Http::fake([
            'oauth2.googleapis.com/*' => Http::response(['access_token' => 'atok', 'expires_in' => 3600], 200),
            'www.googleapis.com/calendar/v3/calendars/*/events*' => Http::response([
                'items' => [],
                'nextSyncToken' => 't1',
            ], 200),
        ]);

        $headers = [
            'X-Goog-Channel-Token' => 'whsec',
            'X-Goog-Channel-ID' => 'ch-1',
            'X-Goog-Resource-ID' => 'res-1',
            'X-Goog-Resource-State' => 'exists',
            'X-Goog-Message-Number' => '1',
        ];

        $this->postJson('/api/v1/assignments/google-calendar/webhook', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'ok');

        // Duplicate notification is idempotent.
        $this->postJson('/api/v1/assignments/google-calendar/webhook', [], $headers)
            ->assertOk()
            ->assertJsonPath('data.status', 'duplicate');
    }

    public function test_calendar_feed_reports_not_configured_status(): void
    {
        config([
            'services.google.calendar_client_id' => null,
            'services.google.calendar_client_secret' => null,
        ]);

        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->getJson('/api/v1/assignments/calendar-feed')
            ->assertOk()
            ->assertJsonPath('data.google_credentials_present', false)
            ->assertJsonPath('data.sync_status', 'not_configured');
    }
}
