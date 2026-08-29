<?php

namespace Tests\Feature\WeeklyReports;

use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WorkplanEvent;
use Tests\TestCase;

class WeeklyReportsPhase3Test extends TestCase
{
    private function seedTeam(): array
    {
        $tenant = Tenant::factory()->create();
        $dept = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Corporate Services',
            'code' => 'CS-P3',
        ]);

        $employee = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $dept->id,
            'is_active' => true,
        ]);
        $employee->assignRole('staff');

        $supervisor = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $dept->id,
            'is_active' => true,
        ]);
        $supervisor->assignRole('HOD');
        $dept->update(['supervisor_id' => $supervisor->id]);

        return [$tenant, $dept, $employee, $supervisor];
    }

    public function test_calendar_meeting_suggestions_appear_as_chips(): void
    {
        [, , $employee] = $this->seedTeam();

        $inWeek = now()->copy()->startOfWeek(\Carbon\Carbon::MONDAY)->addDays(2);

        WorkplanEvent::create([
            'tenant_id' => $employee->tenant_id,
            'created_by' => $employee->id,
            'title' => 'Directorate huddle',
            'type' => 'meeting',
            'date' => $inWeek->toDateString(),
            'end_date' => $inWeek->toDateString(),
        ]);

        $payload = $this->actingAs($employee, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/current/suggestions')
            ->assertOk()
            ->json('data');

        $types = collect($payload['suggestions'])->pluck('source_type')->all();
        $this->assertContains('calendar_meeting', $types);
        $meeting = collect($payload['suggestions'])->firstWhere('source_type', 'calendar_meeting');
        $this->assertSame('Meeting', $meeting['chip_label']);
        $this->assertSame(0, WeeklyReport::where('employee_id', $employee->id)->whereNotNull('submitted_at')->count());
    }

    public function test_donor_template_fields_and_ai_draft_requires_human_confirm(): void
    {
        [, , $employee] = $this->seedTeam();

        $report = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data');

        $this->actingAs($employee, 'sanctum')
            ->putJson('/api/v1/weekly-summaries/'.$report['id'], [
                'donor_code' => 'EU-2026',
                'donor_name' => 'European Union',
                'template_key' => 'donor_progress',
                'programme_id' => null,
                'project_id' => null,
                'additional_notes' => 'Manual notes',
            ])
            ->assertOk()
            ->assertJsonPath('data.donor_code', 'EU-2026')
            ->assertJsonPath('data.template_key', 'donor_progress');

        $draft = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/'.$report['id'].'/ai-draft')
            ->assertOk()
            ->json('data');

        $this->assertTrue($draft['requires_human_confirm']);
        $this->assertFalse($draft['auto_submit']);
        $this->assertStringContainsString('human confirmation', strtolower($draft['draft']));

        $fresh = WeeklyReport::findOrFail($report['id']);
        $this->assertNotNull($fresh->ai_draft_text);
        $this->assertNull($fresh->ai_draft_confirmed_at);
        $this->assertNull($fresh->submitted_at);

        $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/'.$report['id'].'/ai-draft/confirm', [
                'confirm' => true,
            ])
            ->assertOk();

        $confirmed = $fresh->fresh();
        $this->assertNotNull($confirmed->ai_draft_confirmed_at);
        $this->assertSame($employee->id, (int) $confirmed->ai_draft_confirmed_by);
        $this->assertNull($confirmed->submitted_at);
    }
}
