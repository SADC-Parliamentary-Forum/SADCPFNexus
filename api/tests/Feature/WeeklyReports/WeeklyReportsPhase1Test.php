<?php

namespace Tests\Feature\WeeklyReports;

use App\Models\Assignment;
use App\Models\Department;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportItem;
use App\Models\WeeklyReportPriority;
use App\Models\WeeklyReportingPeriod;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WeeklyReportsPhase1Test extends TestCase
{
    private function seedTeam(): array
    {
        $tenant = Tenant::factory()->create();
        $dept = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Corporate Services',
            'code' => 'CS',
        ]);

        $employee = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $dept->id,
        ]);
        $employee->assignRole('staff');

        $supervisor = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $dept->id,
        ]);
        $supervisor->assignRole('HOD');

        $dept->update(['supervisor_id' => $supervisor->id]);

        return [$tenant, $dept, $employee, $supervisor];
    }

    public function test_one_report_per_employee_per_period_idempotent_create(): void
    {
        [, , $employee] = $this->seedTeam();

        $first = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data');

        $second = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data');

        $this->assertSame($first['id'], $second['id']);
        $this->assertSame(1, WeeklyReport::where('employee_id', $employee->id)->count());
    }

    public function test_suggestions_do_not_auto_submit_or_create_items(): void
    {
        [, , $employee] = $this->seedTeam();

        Assignment::create([
            'tenant_id' => $employee->tenant_id,
            'created_by' => $employee->id,
            'assigned_to' => $employee->id,
            'title' => 'Completed briefing',
            'description' => 'Done',
            'due_date' => now()->toDateString(),
            'status' => 'completed',
            'priority' => 'medium',
            'closed_at' => now(),
            'is_confidential' => false,
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
        $this->assertSame(0, WeeklyReportItem::where('weekly_report_id', $report['id'])->count());
        $this->assertContains($report['status'], ['draft', 'exempted']);
    }

    public function test_no_self_accept(): void
    {
        [, , $employee] = $this->seedTeam();

        $reportId = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->json('data.id');

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/items", [
                'section_type' => 'achievement',
                'title' => 'Filed correspondence',
            ])->assertCreated();

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/submit", [
                'declaration_confirmed' => true,
            ])->assertOk();

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/accept")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['reviewer']);
    }

    public function test_confidential_assignment_suggestion_not_leaked_to_outsider(): void
    {
        [$tenant, $dept, $employee, $supervisor] = $this->seedTeam();
        $outsider = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $dept->id,
        ]);
        $outsider->assignRole('staff');

        Assignment::create([
            'tenant_id' => $tenant->id,
            'created_by' => $employee->id,
            'assigned_to' => $employee->id,
            'title' => 'Sensitive follow-up',
            'description' => 'Confidential',
            'due_date' => now()->addDay()->toDateString(),
            'status' => 'active',
            'priority' => 'high',
            'is_confidential' => true,
        ]);

        $outsiderSuggestions = $this->actingAs($outsider, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/current/suggestions')
            ->assertOk()
            ->json('data.suggestions');

        $titles = collect($outsiderSuggestions)->pluck('title')->all();
        $this->assertNotContains('Sensitive follow-up', $titles);

        $ownerSuggestions = $this->actingAs($employee, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/current/suggestions')
            ->assertOk()
            ->json('data.suggestions');

        $this->assertContains('Sensitive follow-up', collect($ownerSuggestions)->pluck('title')->all());
    }

    public function test_consolidation_does_not_mutate_source_report(): void
    {
        [, $dept, $employee, $supervisor] = $this->seedTeam();

        $reportId = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->json('data.id');

        $item = $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/items", [
                'section_type' => 'achievement',
                'title' => 'Hosted briefing',
                'narrative' => 'Original employee narrative',
            ])->json('data');

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/submit", ['declaration_confirmed' => true])
            ->assertOk();

        $this->actingAs($supervisor, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/accept")
            ->assertOk();

        $periodId = WeeklyReport::find($reportId)->period_id;

        $deptReport = $this->actingAs($supervisor, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/department', [
                'period_id' => $periodId,
                'department_id' => $dept->id,
            ])->assertCreated()
            ->json('data');

        $this->actingAs($supervisor, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$deptReport['id']}/consolidate-item", [
                'source_entity_type' => 'item',
                'source_entity_id' => $item['id'],
                'edited_narrative' => 'Department consolidated narrative',
                'title' => 'Dept: Hosted briefing',
            ])->assertOk();

        $source = WeeklyReportItem::find($item['id']);
        $this->assertSame('Original employee narrative', $source->narrative);
        $this->assertSame('Hosted briefing', $source->title);
    }

    public function test_carry_forward_history_is_traceable(): void
    {
        [, , $employee] = $this->seedTeam();

        $reportA = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->json('data');

        $priority = $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportA['id']}/items", [
                'kind' => 'priority',
                'section_type' => 'priority',
                'title' => 'Finalise donor pack',
                'priority_text' => 'Finalise donor pack',
            ])->json('data');

        // Force a distinct period for next week report
        $nextPeriod = WeeklyReportingPeriod::create([
            'tenant_id' => $employee->tenant_id,
            'reference' => 'WRP-TEST-NEXT',
            'start_date' => now()->addWeek()->startOfWeek()->toDateString(),
            'end_date' => now()->addWeek()->startOfWeek()->addDays(4)->toDateString(),
            'status' => 'open',
        ]);

        $reportB = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/', ['period_id' => $nextPeriod->id])
            ->json('data');

        $carried = $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summary-items/{$priority['id']}/carry-forward", [
                'target_report_id' => $reportB['id'],
            ])->assertCreated()
            ->json('data');

        $this->assertSame($priority['id'], $carried['carried_from_priority_id']);
        $this->assertSame(1, $carried['carry_count']);

        $again = WeeklyReportPriority::create([
            'weekly_report_id' => $reportB['id'],
            'priority_text' => 'Finalise donor pack',
            'carried_from_priority_id' => $carried['id'],
            'carry_count' => 2,
            'stale_warning' => true,
        ]);

        $this->assertTrue($again->stale_warning);
        $this->assertSame($carried['id'], $again->carried_from_priority_id);
    }

    public function test_decision_creates_traceable_assignment(): void
    {
        [, , $employee, $supervisor] = $this->seedTeam();

        $reportId = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->json('data.id');

        $decision = $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/items", [
                'kind' => 'decision',
                'section_type' => 'decision',
                'title' => 'Approve venue budget',
                'decision_requested' => 'Approve venue budget',
                'impact_if_delayed' => 'Event slips',
            ])->json('data');

        $recorded = $this->actingAs($supervisor, 'sanctum')
            ->postJson("/api/v1/weekly-summary-items/{$decision['id']}/record-decision", [
                'decision_recorded' => 'Approved with ceiling',
                'create_assignment' => true,
                'assigned_to' => $employee->id,
            ])->assertOk()
            ->json('data');

        $this->assertNotNull($recorded['follow_up_assignment_id']);
        $assignment = Assignment::find($recorded['follow_up_assignment_id']);
        $this->assertSame('weekly_summary', $assignment->source_type);
        $this->assertSame($decision['id'], $assignment->source_id);

        // Idempotent
        $again = $this->actingAs($supervisor, 'sanctum')
            ->postJson("/api/v1/weekly-summary-items/{$decision['id']}/record-decision", [
                'decision_recorded' => 'Approved with ceiling',
                'create_assignment' => true,
                'assigned_to' => $employee->id,
            ])->json('data');

        $this->assertSame($recorded['follow_up_assignment_id'], $again['follow_up_assignment_id']);
    }

    public function test_full_week_leave_auto_exemption(): void
    {
        [, , $employee] = $this->seedTeam();
        $period = app(\App\Modules\WeeklyReports\Services\WeeklyPeriodService::class)->ensureCurrent($employee);

        $leaveData = [
            'requester_id' => $employee->id,
            'tenant_id' => $employee->tenant_id,
            'reference_number' => 'LV-WR-EXEMPT-001',
            'leave_type' => 'annual',
            'start_date' => $period->start_date->toDateString(),
            'end_date' => $period->end_date->toDateString(),
            'days_requested' => 5,
            'reason' => 'Annual leave',
            'status' => 'approved',
        ];

        // LeaveRequest schema varies slightly — fill only existing columns.
        $payload = [];
        foreach ($leaveData as $key => $value) {
            if (Schema::hasColumn('leave_requests', $key)) {
                $payload[$key] = $value;
            }
        }
        LeaveRequest::create($payload);

        $report = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data');

        $this->assertSame('exempted', $report['status']);
    }

    public function test_submit_is_idempotent_for_content_gate_and_resubmit_path(): void
    {
        [, , $employee, $supervisor] = $this->seedTeam();

        $reportId = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->json('data.id');

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/submit", [
                'declaration_confirmed' => true,
            ])->assertStatus(422);

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/items", [
                'section_type' => 'achievement',
                'title' => 'Delivered pack',
            ])->assertCreated();

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/submit", [
                'declaration_confirmed' => true,
            ])->assertOk();

        $this->actingAs($supervisor, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/return", [
                'reason' => 'Clarify achievement outcome',
                'correction_requested' => 'Add result',
            ])->assertOk();

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/items", [
                'section_type' => 'achievement',
                'title' => 'Delivered pack — clarified',
            ])->assertCreated();

        $resubmitted = $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/submit", [
                'declaration_confirmed' => true,
            ])->assertOk()
            ->json('data');

        $this->assertSame('pending_review', $resubmitted['status']);
    }

    public function test_dashboard_missing_and_pending_rows_include_staff_and_department_names(): void
    {
        [, $dept, $employee, $supervisor] = $this->seedTeam();

        $missing = $this->actingAs($supervisor, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/dashboard')
            ->assertOk()
            ->json('data.missing_reports');

        $this->assertIsArray($missing);
        $row = collect($missing)->firstWhere('id', $employee->id);
        $this->assertNotNull($row);
        $this->assertSame($employee->name, $row['name']);
        $this->assertSame($dept->name, $row['department_name']);
        $this->assertSame($dept->name, $row['department']['name'] ?? null);

        $reportId = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->json('data.id');

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/items", [
                'section_type' => 'achievement',
                'title' => 'Delivered pack',
            ])->assertCreated();

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$reportId}/submit", [
                'declaration_confirmed' => true,
            ])->assertOk();

        $pending = $this->actingAs($supervisor, 'sanctum')
            ->getJson('/api/v1/weekly-summaries/dashboard')
            ->assertOk()
            ->json('data.team_pending_reports');

        $this->assertNotEmpty($pending);
        $this->assertSame($employee->name, $pending[0]['employee_name']);
        $this->assertSame($dept->name, $pending[0]['department_name']);
        $this->assertSame($dept->name, $pending[0]['department']['name'] ?? null);
    }

    public function test_department_rollup_includes_department_name_period_dates_and_staff_lists(): void
    {
        [$tenant, $dept, $employee, $supervisor] = $this->seedTeam();

        $absent = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => $dept->id,
            'name' => 'Absent Officer',
            'is_active' => true,
        ]);
        $absent->assignRole('staff');

        $created = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->assertCreated()
            ->json('data');

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$created['id']}/items", [
                'section_type' => 'achievement',
                'title' => 'Department rollup item',
            ])->assertCreated();

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/weekly-summaries/{$created['id']}/submit", [
                'declaration_confirmed' => true,
            ])
            ->assertOk();

        $period = WeeklyReportingPeriod::find($created['period_id']);
        $period->update(['employee_due_at' => now()->subDay()]);

        $payload = $this->actingAs($supervisor, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/department', [
                'period_id' => $period->id,
                'department_id' => $dept->id,
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame($dept->name, $payload['department']['name'] ?? null);
        $this->assertNotEmpty($payload['period']['start_date'] ?? null);
        $this->assertNotEmpty($payload['period']['end_date'] ?? null);
        $this->assertTrue(
            collect($payload['submitted_staff'])->contains(fn ($row) => ($row['name'] ?? null) === $employee->name)
        );
        $this->assertTrue(
            collect($payload['missing_staff'])->contains(fn ($row) => ($row['name'] ?? null) === 'Absent Officer')
        );
        $this->assertTrue(
            collect($payload['late_staff'])->contains(fn ($row) => ($row['name'] ?? null) === 'Absent Officer')
        );
        $this->assertSame(1, $payload['counts']['submitted']);
        $this->assertGreaterThanOrEqual(1, $payload['counts']['missing']);
        $this->assertGreaterThanOrEqual(1, $payload['counts']['late']);
        $this->assertArrayNotHasKey('department_id', $payload['submitted_staff'][0] ?? []);
    }

    public function test_secretary_general_can_open_any_department_rollup(): void
    {
        [$tenant, $dept, $employee] = $this->seedTeam();

        $sg = User::factory()->create([
            'tenant_id' => $tenant->id,
            'department_id' => null,
            'is_active' => true,
        ]);
        $sg->assignRole('Secretary General');

        $periodId = $this->actingAs($employee, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/')
            ->json('data.period_id');

        $this->actingAs($sg, 'sanctum')
            ->postJson('/api/v1/weekly-summaries/department', [
                'period_id' => $periodId,
                'department_id' => $dept->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.department.name', $dept->name);
    }
}
