<?php

namespace Tests\Feature\Timesheets;

use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TimesheetProject;
use App\Models\TimesheetTemplate;
use App\Models\User;
use Carbon\Carbon;
use Tests\TestCase;

class TimesheetTemplateExportTest extends TestCase
{
    private function monday(): string
    {
        return Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function friday(): string
    {
        return Carbon::now()->startOfWeek(Carbon::MONDAY)->addDays(4)->toDateString();
    }

    private function seedEmployee(): array
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->assignRole('staff');
        $hr = User::factory()->create(['tenant_id' => $tenant->id]);
        $hr->assignRole('HR Administrator');

        $project = TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'Sida Gender Programme',
            'sort_order' => 1,
        ]);

        return compact('tenant', 'employee', 'hr', 'project');
    }

    public function test_apply_donor_template_prefills_draft_entries(): void
    {
        $ctx = $this->seedEmployee();

        $template = TimesheetTemplate::create([
            'tenant_id' => $ctx['tenant']->id,
            'name' => 'Sida weekly',
            'code' => 'SIDA-WK',
            'donor_name' => 'Sida',
            'is_active' => true,
            'defaults' => [
                'project_id' => $ctx['project']->id,
                'work_bucket' => 'delivery',
                'activity_type' => 'project_activity',
                'entry_category' => 'donor',
                'description' => 'Sida programme delivery',
                'hours' => 8,
            ],
        ]);

        $res = $this->actingAs($ctx['employee'], 'sanctum')
            ->postJson("/api/v1/hr/timesheets/templates/{$template->id}/apply", [
                'week_start' => $this->monday(),
                'week_end' => $this->friday(),
            ])
            ->assertCreated()
            ->assertJsonPath('data.template.code', 'SIDA-WK');

        $timesheetId = $res->json('data.timesheet.id');
        $this->assertNotNull($timesheetId);

        $entries = TimesheetEntry::where('timesheet_id', $timesheetId)->get();
        $this->assertGreaterThanOrEqual(5, $entries->count());
        $this->assertTrue($entries->every(fn ($e) => (int) $e->project_id === (int) $ctx['project']->id));
        $this->assertTrue($entries->every(fn ($e) => $e->work_bucket === 'delivery'));
        $this->assertTrue($entries->every(fn ($e) => $e->entry_category === 'donor'));
        $this->assertSame('Sida programme delivery', $entries->first()->description);
    }

    public function test_timesheet_csv_export_includes_entry_rows(): void
    {
        $ctx = $this->seedEmployee();
        $weekStart = $this->monday();
        $weekEnd = $this->friday();

        $timesheet = Timesheet::create([
            'tenant_id' => $ctx['tenant']->id,
            'user_id' => $ctx['employee']->id,
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'week_number' => Carbon::parse($weekStart)->isoWeek(),
            'total_hours' => 8,
            'overtime_hours' => 0,
            'status' => 'approved',
        ]);

        TimesheetEntry::create([
            'timesheet_id' => $timesheet->id,
            'project_id' => $ctx['project']->id,
            'work_date' => $weekStart,
            'hours' => 8,
            'overtime_hours' => 0,
            'description' => 'Delivery work',
            'work_bucket' => 'delivery',
            'source_type' => 'manual',
        ]);

        $csv = $this->actingAs($ctx['hr'], 'sanctum')
            ->get("/api/v1/hr/timesheets/{$timesheet->id}/export?format=csv")
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $body = $csv->streamedContent();
        $this->assertStringContainsString('work_date', $body);
        $this->assertStringContainsString('Delivery work', $body);
        $this->assertStringContainsString('Sida Gender Programme', $body);
    }

    public function test_timesheet_pdf_export_returns_pdf_bytes(): void
    {
        $ctx = $this->seedEmployee();
        $weekStart = $this->monday();
        $weekEnd = $this->friday();

        $timesheet = Timesheet::create([
            'tenant_id' => $ctx['tenant']->id,
            'user_id' => $ctx['employee']->id,
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'week_number' => Carbon::parse($weekStart)->isoWeek(),
            'total_hours' => 8,
            'overtime_hours' => 0,
            'status' => 'submitted',
        ]);

        TimesheetEntry::create([
            'timesheet_id' => $timesheet->id,
            'work_date' => $weekStart,
            'hours' => 8,
            'overtime_hours' => 0,
            'description' => 'PDF row',
            'source_type' => 'manual',
        ]);

        $res = $this->actingAs($ctx['employee'], 'sanctum')
            ->get("/api/v1/hr/timesheets/{$timesheet->id}/export?format=pdf")
            ->assertOk();

        $this->assertStringContainsString('pdf', strtolower($res->headers->get('content-type')));
        $this->assertStringStartsWith('%PDF', $res->getContent());
    }

    public function test_list_templates_returns_active_templates_for_tenant(): void
    {
        $ctx = $this->seedEmployee();
        TimesheetTemplate::create([
            'tenant_id' => $ctx['tenant']->id,
            'name' => 'EU template',
            'code' => 'EU-01',
            'donor_name' => 'EU',
            'is_active' => true,
            'defaults' => ['work_bucket' => 'administration', 'hours' => 4],
        ]);

        $this->actingAs($ctx['employee'], 'sanctum')
            ->getJson('/api/v1/hr/timesheets/templates')
            ->assertOk()
            ->assertJsonFragment(['code' => 'EU-01', 'donor_name' => 'EU']);
    }
}
