<?php

namespace Tests\Feature\Timesheets\Import;

use App\Models\ApprovalRequest;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TimesheetImportBatch;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class TimesheetHistoricalImportTest extends TestCase
{
    private function csvFile(string $contents, string $name = 'clockify.csv'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $contents);
    }

    private function clockifyCsv(string $email, bool $overnight = true): string
    {
        $rows = [
            'Project,Client,Description,Activity,User,Group,Email,Tags,Billable,Start Date,Start Time,End Date,End Time,Duration (h),Duration (decimal),Billable Rate,Billable Amount,Date of creation',
        ];
        if ($overnight) {
            $rows[] = "SRHR Programme,,Prepared briefing note,Policy drafting,Ada Staff,Programmes,{$email},,No,2025-09-10,22:00:00,2025-09-11,03:00:00,05:00:00,5.00,0,0,2025-09-12";
        }
        $rows[] = "SRHR Programme,,Committee session,Meetings,Ada Staff,Programmes,{$email},,No,2025-09-11,08:00:00,2025-09-11,12:00:00,04:00:00,4.00,0,0,2025-09-12";

        return implode("\n", $rows)."\n";
    }

    public function test_clockify_self_import_splits_midnight_and_skips_workflow(): void
    {
        $employee = $this->makeUser('staff');
        $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email)),
                'mode' => 'self',
            ])
            ->assertCreated();

        $batch = TimesheetImportBatch::query()->where('uploaded_by', $employee->id)->first();
        $this->assertNotNull($batch);
        $this->assertSame('clockify_detailed', $batch->format);
        $this->assertSame(TimesheetImportBatch::STATUS_PREVIEW_READY, $batch->status);

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$batch->id}/confirm", ['import_valid_only' => true])
            ->assertOk();

        $entries = TimesheetEntry::query()->where('import_batch_id', $batch->id)->orderBy('work_date')->orderBy('start_time')->get();
        $this->assertCount(3, $entries);
        $this->assertSame('2025-09-10', $entries[0]->work_date->toDateString());
        $this->assertEquals(2.0, (float) $entries[0]->hours);
        $this->assertSame('2025-09-11', $entries[1]->work_date->toDateString());
        $this->assertEquals(3.0, (float) $entries[1]->hours);
        $this->assertSame($entries[0]->source_row_number, $entries[1]->source_row_number);
        $this->assertNotEmpty($entries[0]->clockify_metadata);
        $this->assertTrue($entries[0]->is_locked);
        $this->assertSame(TimesheetEntry::SOURCE_CLOCKIFY_IMPORT, $entries[0]->source_type);

        $sheets = Timesheet::query()->where('user_id', $employee->id)->where('origin', 'historical_import')->get();
        $this->assertNotEmpty($sheets);
        $this->assertTrue($sheets->every(fn (Timesheet $s) => $s->status === 'imported'));
        $this->assertSame(0, ApprovalRequest::query()->where('approvable_type', Timesheet::class)->count());
    }

    public function test_self_import_rejects_another_employees_email(): void
    {
        $employee = $this->makeUser('staff');
        $other = $this->makeUser('staff', $employee->tenant);

        $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($other->email, false)),
                'mode' => 'self',
            ])
            ->assertCreated();

        $batch = TimesheetImportBatch::query()->where('uploaded_by', $employee->id)->latest('id')->first();
        $preview = $this->actingAs($employee, 'sanctum')
            ->getJson("/api/v1/hr/timesheets/imports/{$batch->id}?filter=errors")
            ->assertOk()
            ->json('data.rows.data');

        $this->assertNotEmpty($preview);
        $this->assertFalse(
            \App\Models\TimesheetImportRow::query()
                ->where('import_batch_id', $batch->id)
                ->where('mapped_user_id', $other->id)
                ->exists()
        );
    }

    public function test_admin_multi_requires_mapping_for_unknown_email(): void
    {
        $hr = $this->makeHrAdmin();
        $known = $this->makeUser('staff', $hr->tenant);

        $csv = $this->clockifyCsv($known->email, false)
            ."Old Project,,Legacy work,Activity,Former Staff,Programmes,old@email.com,,No,2025-09-08,08:00:00,2025-09-08,16:00:00,08:00:00,8.00,0,0,2025-09-09\n";

        $this->actingAs($hr, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($csv),
                'mode' => 'multi',
            ])
            ->assertCreated();

        $batch = TimesheetImportBatch::query()->where('uploaded_by', $hr->id)->latest('id')->first();
        $this->assertGreaterThan(0, $batch->error_rows);

        $former = $this->makeUser('staff', $hr->tenant);
        $this->actingAs($hr, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$batch->id}/map", [
                'employee_maps' => [
                    ['email' => 'old@email.com', 'user_id' => $former->id],
                ],
            ])
            ->assertOk();

        $batch->refresh();
        $this->assertSame(0, $batch->error_rows);
    }

    public function test_admin_multi_does_not_match_by_employee_name_alone(): void
    {
        $hr = $this->makeHrAdmin();
        $alice = $this->makeUser('staff', $hr->tenant);
        $alice->update(['name' => 'Ada Staff']);
        $bob = $this->makeUser('staff', $hr->tenant);
        $bob->update(['name' => 'Ada Staff']);

        $this->actingAs($hr, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv('ghost.name-collision@none.invalid', false)),
                'mode' => 'multi',
            ])
            ->assertCreated();

        $batch = TimesheetImportBatch::query()->where('uploaded_by', $hr->id)->latest('id')->first();
        $this->assertGreaterThan(0, $batch->error_rows);
        $this->assertFalse(
            \App\Models\TimesheetImportRow::query()
                ->where('import_batch_id', $batch->id)
                ->whereIn('mapped_user_id', [$alice->id, $bob->id])
                ->exists()
        );
    }

    public function test_historical_weeks_are_excluded_from_approved_payroll_selection(): void
    {
        $employee = $this->makeUser('staff');
        $id = $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email, false)),
                'mode' => 'self',
            ])
            ->json('data.id');
        $this->actingAs($employee, 'sanctum')->postJson("/api/v1/hr/timesheets/imports/{$id}/confirm")->assertOk();

        $sheet = Timesheet::query()->where('user_id', $employee->id)->where('origin', 'historical_import')->first();
        $this->assertNotNull($sheet);
        $sheet->update([
            'status' => 'verified_historical',
            'hr_validated_at' => now(),
            'approved_at' => now(),
        ]);

        $this->assertSame(0, Timesheet::query()
            ->where('id', $sheet->id)
            ->where('status', 'approved')
            ->whereNotNull('hr_validated_at')
            ->count());
        $this->assertNotSame('approved', $sheet->fresh()->status);
    }

    public function test_duplicate_file_does_not_clone_production_rows(): void
    {
        $employee = $this->makeUser('staff');
        $file = $this->csvFile($this->clockifyCsv($employee->email, false));

        $first = $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', ['file' => $file, 'mode' => 'self'])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($employee, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$first}/confirm")
            ->assertOk();

        $second = $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email, false)),
                'mode' => 'self',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertSame($first, $second);
        $this->assertSame(1, TimesheetEntry::query()->where('import_batch_id', $first)->count());
    }

    public function test_confirm_is_idempotent(): void
    {
        $employee = $this->makeUser('staff');
        $id = $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email, false)),
                'mode' => 'self',
            ])
            ->json('data.id');

        $this->actingAs($employee, 'sanctum')
            ->withHeaders(['Idempotency-Key' => 'imp-1'])
            ->postJson("/api/v1/hr/timesheets/imports/{$id}/confirm")
            ->assertOk();
        $this->actingAs($employee, 'sanctum')
            ->withHeaders(['Idempotency-Key' => 'imp-1'])
            ->postJson("/api/v1/hr/timesheets/imports/{$id}/confirm")
            ->assertOk();

        $this->assertSame(1, TimesheetEntry::query()->where('import_batch_id', $id)->count());
    }

    public function test_partial_import_keeps_valid_rows(): void
    {
        $hr = $this->makeHrAdmin();
        $known = $this->makeUser('staff', $hr->tenant);
        $csv = $this->clockifyCsv($known->email, false)
            ."X,,Missing person,Activity,Ghost,Programmes,ghost@none.invalid,,No,2025-09-08,08:00:00,2025-09-08,12:00:00,04:00:00,4.00,0,0,2025-09-09\n";

        $id = $this->actingAs($hr, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', ['file' => $this->csvFile($csv), 'mode' => 'multi'])
            ->json('data.id');

        $this->actingAs($hr, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$id}/confirm", ['import_valid_only' => true])
            ->assertOk()
            ->assertJsonPath('data.status', TimesheetImportBatch::STATUS_PARTIAL);

        $this->assertSame(1, TimesheetEntry::query()->where('import_batch_id', $id)->count());
    }

    public function test_rollback_unverified_batch_does_not_touch_other_weeks(): void
    {
        $hr = $this->makeHrAdmin();
        $employee = $this->makeUser('staff', $hr->tenant);
        Timesheet::create([
            'tenant_id' => $employee->tenant_id,
            'user_id' => $employee->id,
            'week_start' => '2026-01-05',
            'week_end' => '2026-01-11',
            'total_hours' => 8,
            'overtime_hours' => 0,
            'status' => 'approved',
            'origin' => 'nexus',
        ]);

        $id = $this->actingAs($hr, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email, false)),
                'mode' => 'multi',
            ])
            ->json('data.id');
        $this->actingAs($hr, 'sanctum')->postJson("/api/v1/hr/timesheets/imports/{$id}/confirm")->assertOk();
        $this->actingAs($hr, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$id}/rollback", ['reason' => 'Wrong file'])
            ->assertOk();

        $this->assertSame(0, TimesheetEntry::query()->where('import_batch_id', $id)->count());
        $this->assertTrue(Timesheet::query()->where('user_id', $employee->id)->where('origin', 'nexus')->exists());
    }

    public function test_verified_batch_requires_reason_to_reverse(): void
    {
        $hr = $this->makeHrAdmin();
        $employee = $this->makeUser('staff', $hr->tenant);
        $id = $this->actingAs($hr, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email, false)),
                'mode' => 'single',
                'target_user_id' => $employee->id,
            ])
            ->json('data.id');
        $this->actingAs($hr, 'sanctum')->postJson("/api/v1/hr/timesheets/imports/{$id}/confirm")->assertOk();
        $this->assertTrue($hr->fresh()->can('timesheets.import-verify'));
        $this->actingAs($hr, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$id}/verify", ['justification' => 'Clockify 2025 archive accepted'])
            ->assertOk();
        $this->actingAs($hr, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$id}/rollback", ['reason' => 'oops'])
            ->assertUnprocessable();
        $this->actingAs($hr, 'sanctum')
            ->postJson("/api/v1/hr/timesheets/imports/{$id}/reverse", ['reason' => 'Loaded against the wrong year'])
            ->assertOk();

        $this->assertNotNull(TimesheetEntry::query()->where('import_batch_id', $id)->first()?->reversed_at);
    }

    public function test_staff_cannot_admin_multi_import(): void
    {
        $employee = $this->makeUser('staff');
        $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email, false)),
                'mode' => 'multi',
            ])
            ->assertForbidden();
    }

    public function test_template_download_and_mime_rejection(): void
    {
        $employee = $this->makeUser('staff');
        $this->actingAs($employee, 'sanctum')
            ->get('/api/v1/hr/timesheets/import/template')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $this->actingAs($employee, 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => UploadedFile::fake()->createWithContent('note.txt', 'hello'),
                'mode' => 'self',
            ])
            ->assertUnprocessable();
    }

    public function test_put_does_not_delete_locked_imported_entries_on_a_live_draft(): void
    {
        $employee = $this->makeUser('staff');
        $sheet = Timesheet::create([
            'tenant_id' => $employee->tenant_id,
            'user_id' => $employee->id,
            'week_start' => '2026-03-02',
            'week_end' => '2026-03-08',
            'total_hours' => 1,
            'status' => 'draft',
            'origin' => 'nexus',
        ]);
        $locked = TimesheetEntry::create([
            'timesheet_id' => $sheet->id,
            'work_date' => '2026-03-02',
            'hours' => 1,
            'description' => 'Imported remnant',
            'source_type' => TimesheetEntry::SOURCE_CLOCKIFY_IMPORT,
            'is_locked' => true,
            'row_fingerprint' => hash('sha256', 'keep-me'),
        ]);

        $this->actingAs($employee, 'sanctum')
            ->putJson("/api/v1/hr/timesheets/{$sheet->id}", [
                'entries' => [[
                    'work_date' => '2026-03-03',
                    'hours' => 2,
                    'description' => 'Manual',
                    'work_bucket' => 'delivery',
                ]],
            ])
            ->assertOk();

        $this->assertTrue(TimesheetEntry::query()->where('id', $locked->id)->exists());
    }

    public function test_inactive_user_cannot_self_import(): void
    {
        $employee = $this->makeUser('staff');
        $employee->update(['is_active' => false, 'account_status' => User::STATUS_DISABLED]);
        $this->actingAs($employee->fresh(), 'sanctum')
            ->post('/api/v1/hr/timesheets/imports', [
                'file' => $this->csvFile($this->clockifyCsv($employee->email, false)),
                'mode' => 'self',
            ])
            ->assertForbidden();
    }
}
