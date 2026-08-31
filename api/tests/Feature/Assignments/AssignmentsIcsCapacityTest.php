<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class AssignmentsIcsCapacityTest extends TestCase
{
    private function seedAssignment(Tenant $tenant, User $creator, User $assignee, array $overrides = []): Assignment
    {
        return Assignment::create(array_merge([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'assigned_to' => $assignee->id,
            'title' => 'ICS capacity item',
            'description' => 'For calendar export',
            'due_date' => now()->addDays(3)->toDateString(),
            'start_date' => now()->toDateString(),
            'status' => 'active',
            'priority' => 'high',
            'is_template' => false,
        ], $overrides));
    }

    public function test_ics_export_returns_vcalendar_feed(): void
    {
        $tenant = Tenant::factory()->create();
        $creator = $this->makeUser('staff', $tenant);
        $assignee = $this->makeUser('staff', $tenant);
        $assignment = $this->seedAssignment($tenant, $creator, $assignee, [
            'title' => 'Prepare briefing pack',
        ]);

        $response = $this->actingAs($assignee, 'sanctum')
            ->get('/api/v1/assignments/calendar.ics?scope=mine')
            ->assertOk();

        $this->assertStringContainsString('text/calendar', (string) $response->headers->get('Content-Type'));
        $body = $response->getContent();
        $this->assertStringContainsString('BEGIN:VCALENDAR', $body);
        $this->assertStringContainsString('VERSION:2.0', $body);
        $this->assertStringContainsString('BEGIN:VEVENT', $body);
        $this->assertStringContainsString('Prepare briefing pack', $body);
        $this->assertStringContainsString('UID:assignment-'.$assignment->id.'@sadcpf-nexus', $body);
        $this->assertStringContainsString('END:VCALENDAR', $body);
    }

    public function test_ics_feed_works_without_google_credentials(): void
    {
        config(['services.google.calendar_client_id' => null, 'services.google.calendar_client_secret' => null]);

        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $this->seedAssignment($tenant, $user, $user);

        $payload = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/assignments/calendar-feed')
            ->assertOk()
            ->assertJsonPath('data.provider', 'ics')
            ->assertJsonPath('data.google_credentials_present', false)
            ->assertJsonStructure(['data' => ['subscribe_url', 'download_url', 'provider', 'instructions']])
            ->json('data');

        $this->assertNotSame($payload['download_url'], $payload['subscribe_url']);
        $this->assertStringContainsString('calendar-subscribe', $payload['subscribe_url']);
        $this->assertStringContainsString('calendar.ics', $payload['download_url']);
        $this->assertStringNotContainsString('calendar-subscribe', $payload['download_url']);
    }

    public function test_unauthenticated_ics_download_still_requires_sanctum(): void
    {
        $this->getJson('/api/v1/assignments/calendar.ics?scope=mine')->assertUnauthorized();
    }

    public function test_calendar_clients_can_fetch_subscribe_feed_with_opaque_token(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $mine = $this->seedAssignment($tenant, $user, $user, [
            'title' => 'Mine subscribe event',
        ]);
        $this->seedAssignment($tenant, $other, $other, [
            'title' => 'Someone else private task',
        ]);

        $payload = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/assignments/calendar-feed')
            ->assertOk()
            ->json('data');

        $path = $this->pathFromUrl($payload['subscribe_url']);
        $this->flushAuthGuards();

        $response = $this->get($path)->assertOk();
        $this->assertStringContainsString('text/calendar', (string) $response->headers->get('Content-Type'));
        $this->assertStringContainsString('inline', (string) $response->headers->get('Content-Disposition'));
        $body = $response->getContent();
        $this->assertStringContainsString('BEGIN:VCALENDAR', $body);
        $this->assertStringContainsString('Mine subscribe event', $body);
        $this->assertStringContainsString('UID:assignment-'.$mine->id.'@sadcpf-nexus', $body);
        $this->assertStringNotContainsString('Someone else private task', $body);

        $this->get($path.'.ics')->assertOk()
            ->assertSee('Mine subscribe event', false);
    }

    public function test_unknown_subscribe_token_returns_not_found(): void
    {
        $this->get('/api/v1/assignments/calendar-subscribe/not-a-real-token')->assertNotFound();
    }

    public function test_disabled_user_subscribe_token_returns_not_found(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $this->seedAssignment($tenant, $user, $user, ['title' => 'Should vanish when disabled']);

        $payload = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/assignments/calendar-feed')
            ->assertOk()
            ->json('data');

        $path = $this->pathFromUrl($payload['subscribe_url']);

        $user->update(['is_active' => false]);
        $this->flushAuthGuards();

        $this->get($path)->assertNotFound();
    }

    public function test_rotating_ics_feed_invalidates_previous_subscribe_url(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $this->seedAssignment($tenant, $user, $user, ['title' => 'Rotate feed event']);

        $before = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/assignments/calendar-feed')
            ->assertOk()
            ->json('data');

        $oldPath = $this->pathFromUrl($before['subscribe_url']);

        $after = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/assignments/calendar-feed/rotate')
            ->assertOk()
            ->assertJsonPath('data.provider', 'ics')
            ->json('data');

        $this->assertNotSame($before['subscribe_url'], $after['subscribe_url']);
        $this->assertStringContainsString('calendar-subscribe', $after['subscribe_url']);

        $this->flushAuthGuards();
        $this->get($oldPath)->assertNotFound();
        $this->get($this->pathFromUrl($after['subscribe_url']))->assertOk()
            ->assertSee('Rotate feed event', false);
    }

    private function pathFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH);
        $this->assertIsString($path);
        $this->assertNotSame('', $path);

        return $path;
    }

    private function flushAuthGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }

    public function test_capacity_view_aggregates_open_workload_per_assignee(): void
    {
        $tenant = Tenant::factory()->create();
        $dept = Department::create(['tenant_id' => $tenant->id, 'name' => 'Ops', 'code' => 'OPS-CAP']);
        $creator = User::factory()->create(['tenant_id' => $tenant->id, 'department_id' => $dept->id]);
        $creator->assignRole('HOD');
        $a = User::factory()->create(['tenant_id' => $tenant->id, 'department_id' => $dept->id, 'name' => 'Alice Load']);
        $a->assignRole('staff');
        $b = User::factory()->create(['tenant_id' => $tenant->id, 'department_id' => $dept->id, 'name' => 'Bob Light']);
        $b->assignRole('staff');

        $this->seedAssignment($tenant, $creator, $a, ['department_id' => $dept->id, 'priority' => 'critical', 'status' => 'active']);
        $this->seedAssignment($tenant, $creator, $a, [
            'department_id' => $dept->id,
            'priority' => 'high',
            'status' => 'active',
            'due_date' => now()->subDay()->toDateString(),
            'title' => 'Overdue for Alice',
        ]);
        $this->seedAssignment($tenant, $creator, $b, ['department_id' => $dept->id, 'priority' => 'low', 'status' => 'active']);
        $this->seedAssignment($tenant, $creator, $a, ['department_id' => $dept->id, 'status' => 'closed', 'title' => 'Closed ignore']);

        $payload = $this->actingAs($creator, 'sanctum')
            ->getJson('/api/v1/assignments/capacity?department_id='.$dept->id)
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($payload['assignees']);
        $alice = collect($payload['assignees'])->firstWhere('user_id', $a->id);
        $bob = collect($payload['assignees'])->firstWhere('user_id', $b->id);

        $this->assertSame(2, $alice['open_count']);
        $this->assertSame(1, $alice['overdue_count']);
        $this->assertGreaterThan($bob['load_score'], $alice['load_score']);
        $this->assertContains($alice['load_band'], ['high', 'critical', 'medium']);
        $this->assertSame(1, $bob['open_count']);
        $this->assertArrayHasKey('summary', $payload);
    }
}
