<?php

namespace Tests\Feature\WeeklyReports;

use App\Models\Assignment;
use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WorkplanEvent;
use Tests\TestCase;

class WeeklyReportsStrongerAiDraftTest extends TestCase
{
    private function seedTeam(): array
    {
        $tenant = Tenant::factory()->create();
        $dept = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Policy',
            'code' => 'POL-AI',
        ]);

        $employee = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $dept->id,
            'is_active' => true,
        ]);
        $employee->assignRole('staff');

        return [$tenant, $dept, $employee];
    }

    public function test_stronger_ai_draft_groups_suggestions_by_section_and_still_requires_confirm(): void
    {
        [, , $employee] = $this->seedTeam();

        $inWeek = now()->copy()->startOfWeek(\Carbon\Carbon::MONDAY)->addDays(2)->setTime(12, 0);

        Assignment::create([
            'tenant_id' => $employee->tenant_id,
            'created_by' => $employee->id,
            'assigned_to' => $employee->id,
            'title' => 'Finalise briefing note',
            'description' => 'Completed this week',
            'due_date' => $inWeek->toDateString(),
            'status' => 'completed',
            'priority' => 'medium',
            'is_template' => false,
            'completed_at' => $inWeek,
            'closed_at' => $inWeek,
        ]);

        WorkplanEvent::create([
            'tenant_id' => $employee->tenant_id,
            'created_by' => $employee->id,
            'title' => 'Sector coordination call',
            'type' => 'meeting',
            'date' => $inWeek->toDateString(),
            'end_date' => $inWeek->toDateString(),
        ]);

        $report = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data');

        $suggestions = $this->actingAs($employee, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/current/suggestions')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($suggestions['suggestions']);

        $draft = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/'.$report['id'].'/ai-draft')
            ->assertOk()
            ->json('data');

        $this->assertTrue($draft['requires_human_confirm']);
        $this->assertFalse($draft['auto_submit']);
        $this->assertArrayHasKey('sections', $draft);
        $this->assertIsArray($draft['sections']);
        $text = strtolower($draft['draft']);
        $this->assertStringContainsString('human confirmation', $text);
        $this->assertTrue(
            str_contains($text, 'achievement')
            || str_contains($text, 'meeting')
            || str_contains($text, 'work in progress')
            || str_contains($text, 'wip')
        );
        $this->assertGreaterThan(2, substr_count($draft['draft'], "\n"));

        $fresh = WeeklyReport::findOrFail($report['id']);
        $this->assertNull($fresh->submitted_at);
        $this->assertNull($fresh->ai_draft_confirmed_at);
    }
}
