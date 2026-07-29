<?php

namespace Tests\Feature\Timesheets;

use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TimesheetProject;
use App\Models\User;
use Carbon\Carbon;
use Tests\TestCase;

class TimesheetXlsxExportTest extends TestCase
{
    public function test_excel_export_returns_true_xlsx_not_csv(): void
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->assignRole('staff');
        $hr = User::factory()->create(['tenant_id' => $tenant->id]);
        $hr->assignRole('HR Administrator');

        $project = TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'Sida Gender',
            'sort_order' => 1,
        ]);

        $weekStart = Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = Carbon::now()->startOfWeek(Carbon::MONDAY)->addDays(4)->toDateString();

        $timesheet = Timesheet::create([
            'tenant_id' => $tenant->id,
            'user_id' => $employee->id,
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'week_number' => Carbon::parse($weekStart)->isoWeek(),
            'total_hours' => 8,
            'overtime_hours' => 0,
            'status' => 'approved',
        ]);

        TimesheetEntry::create([
            'timesheet_id' => $timesheet->id,
            'project_id' => $project->id,
            'work_date' => $weekStart,
            'hours' => 8,
            'overtime_hours' => 0,
            'description' => 'XLSX row payload',
            'work_bucket' => 'delivery',
            'source_type' => 'manual',
        ]);

        $res = $this->actingAs($hr, 'sanctum')
            ->get("/api/v1/hr/timesheets/{$timesheet->id}/export?format=excel")
            ->assertOk();

        $contentType = strtolower((string) $res->headers->get('content-type'));
        $this->assertTrue(
            str_contains($contentType, 'spreadsheetml')
                || str_contains($contentType, 'officedocument')
                || str_contains($contentType, 'application/vnd.openxmlformats'),
            "Expected OpenXML content-type, got: {$contentType}"
        );

        $disposition = (string) $res->headers->get('content-disposition');
        $this->assertStringContainsString('.xlsx', $disposition);

        $body = $res->streamedContent();
        $this->assertNotSame('', $body);
        // XLSX is a ZIP archive — local file header magic "PK\x03\x04"
        $this->assertSame("PK\x03\x04", substr($body, 0, 4));
        $this->assertStringNotContainsString('work_date,hours', $body);
        $this->assertStringNotContainsString('employee,employee_id', $body);
    }

    public function test_csv_and_pdf_exports_still_available(): void
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->assignRole('staff');

        $weekStart = Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = Carbon::now()->startOfWeek(Carbon::MONDAY)->addDays(4)->toDateString();

        $timesheet = Timesheet::create([
            'tenant_id' => $tenant->id,
            'user_id' => $employee->id,
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
            'description' => 'CSV still works',
            'source_type' => 'manual',
        ]);

        $csv = $this->actingAs($employee, 'sanctum')
            ->get("/api/v1/hr/timesheets/{$timesheet->id}/export?format=csv")
            ->assertOk();
        $this->assertStringContainsString('CSV still works', $csv->streamedContent());

        $pdf = $this->actingAs($employee, 'sanctum')
            ->get("/api/v1/hr/timesheets/{$timesheet->id}/export?format=pdf")
            ->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
    }
}
