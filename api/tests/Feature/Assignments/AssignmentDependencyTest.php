<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\Tenant;
use Tests\TestCase;

class AssignmentDependencyTest extends TestCase
{
    private function makeAssignment($user, array $extra = []): Assignment
    {
        return Assignment::create(array_merge([
            'tenant_id' => $user->tenant_id,
            'title' => 'Dep '.uniqid(),
            'description' => 'Dependency test assignment',
            'status' => 'active',
            'priority' => 'medium',
            'created_by' => $user->id,
            'assigned_to' => $user->id,
            'department_id' => $user->department_id,
            'estimated_hours' => 8,
            'is_template' => false,
            'due_date' => now()->addDays(7)->toDateString(),
            'start_date' => now()->toDateString(),
        ], $extra));
    }

    public function test_add_list_and_reject_cycle(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $a = $this->makeAssignment($user, ['title' => 'A']);
        $b = $this->makeAssignment($user, ['title' => 'B']);
        $c = $this->makeAssignment($user, ['title' => 'C']);

        $http->postJson("/api/v1/assignments/{$a->id}/dependencies", [
            'depends_on_assignment_id' => $b->id,
        ])->assertCreated();

        $http->postJson("/api/v1/assignments/{$b->id}/dependencies", [
            'depends_on_assignment_id' => $c->id,
        ])->assertCreated();

        // Cycle: C depends on A while A→B→C
        $http->postJson("/api/v1/assignments/{$c->id}/dependencies", [
            'depends_on_assignment_id' => $a->id,
        ])->assertStatus(422);

        $list = $http->getJson("/api/v1/assignments/{$a->id}/dependencies")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $list['blocked_by']);
        $this->assertSame($b->id, (int) $list['blocked_by'][0]['depends_on_assignment_id']);
    }

    public function test_workload_forecast_uses_estimated_hours(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $this->makeAssignment($user, ['estimated_hours' => 40, 'status' => 'active']);
        $this->makeAssignment($user, ['estimated_hours' => 40, 'status' => 'active']);

        $data = $http->getJson('/api/v1/assignments/workload-forecast?weeks=1')
            ->assertOk()
            ->json('data');

        $mine = collect($data['assignees'])->firstWhere('user_id', $user->id);
        $this->assertNotNull($mine);
        $this->assertEquals(80.0, (float) $mine['estimated_hours_total']);
        $this->assertEquals(40.0, (float) $mine['available_hours']);
        $this->assertGreaterThanOrEqual(100, (float) $mine['utilization_pct']);
    }

    public function test_ics_import_creates_draft_assignments(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:test-1\nSUMMARY:Imported Task\nDTSTART:20260701\nDTEND:20260702\nEND:VEVENT\nEND:VCALENDAR\n";

        $res = $http->postJson('/api/v1/assignments/calendar/import-ics', [
            'ics' => $ics,
        ])->assertCreated()->json('data');

        $this->assertCount(1, $res['created']);
        $this->assertSame('Imported Task', $res['created'][0]['title']);
    }
}

