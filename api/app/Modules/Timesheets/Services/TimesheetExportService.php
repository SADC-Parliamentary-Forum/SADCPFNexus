<?php

namespace App\Modules\Timesheets\Services;

use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TimesheetTemplate;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetExportService
{
    public function __construct(
        private readonly TimesheetService $timesheetService,
    ) {}

    /**
     * Apply a donor/project template onto a draft timesheet for the week.
     * Prefills ordinary working days only — never invents overtime rates or OT hours.
     */
    public function applyTemplate(User $user, TimesheetTemplate $template, string $weekStart, string $weekEnd): Timesheet
    {
        if ((int) $template->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! $template->is_active) {
            throw ValidationException::withMessages(['template' => 'Template is inactive.']);
        }

        $defaults = $template->defaults ?? [];
        $hours = (float) ($defaults['hours'] ?? 8);
        if ($hours < 0 || $hours > 24) {
            throw ValidationException::withMessages(['defaults.hours' => 'Template hours must be between 0 and 24.']);
        }

        $expected = $this->timesheetService->calculateExpectedHours($user, $weekStart, $weekEnd);
        $leave = $this->timesheetService->getLeaveDays($user, $weekStart, $weekEnd);
        $travel = $this->timesheetService->getTravelDays($user, $weekStart, $weekEnd);
        $holidays = $this->timesheetService->getHolidayDates($user, $weekStart, $weekEnd);

        return DB::transaction(function () use ($user, $template, $defaults, $hours, $weekStart, $weekEnd, $expected, $leave, $travel, $holidays) {
            $period = $this->timesheetService->ensurePeriod((int) $user->tenant_id, $weekStart, $weekEnd);
            $this->timesheetService->assertPeriodEditable($period);

            $timesheet = Timesheet::query()
                ->where('user_id', $user->id)
                ->where('week_start', $weekStart)
                ->first();

            if ($timesheet && ! in_array($timesheet->status, ['draft', 'returned'], true)) {
                throw ValidationException::withMessages([
                    'timesheet' => 'Only draft or returned timesheets can receive a template.',
                ]);
            }

            if (! $timesheet) {
                $timesheet = Timesheet::create([
                    'tenant_id' => $user->tenant_id,
                    'period_id' => $period->id,
                    'user_id' => $user->id,
                    'week_start' => $weekStart,
                    'week_end' => $weekEnd,
                    'week_number' => Carbon::parse($weekStart)->isoWeek(),
                    'total_hours' => 0,
                    'overtime_hours' => 0,
                    'status' => 'draft',
                ]);
            } else {
                $timesheet->update(['period_id' => $period->id, 'status' => 'draft']);
                $timesheet->entries()->where('is_locked', false)->where('source_type', 'manual')->delete();
            }

            $total = 0.0;
            foreach (CarbonPeriod::create($weekStart, $weekEnd) as $day) {
                /** @var Carbon $day */
                $key = $day->format('Y-m-d');
                $dayMeta = $expected['days'][$key] ?? ['expected' => 0.0, 'status' => 'weekend'];

                if (($dayMeta['status'] ?? '') !== 'working') {
                    continue;
                }
                if (isset($leave[$key]) || isset($travel[$key]) || isset($holidays[$key])) {
                    continue;
                }

                $entryHours = $hours > 0 ? $hours : (float) ($dayMeta['expected'] ?? 8);
                TimesheetEntry::create([
                    'timesheet_id' => $timesheet->id,
                    'project_id' => $defaults['project_id'] ?? null,
                    'work_bucket' => $defaults['work_bucket'] ?? null,
                    'activity_type' => $defaults['activity_type'] ?? null,
                    'entry_category' => $defaults['entry_category'] ?? null,
                    'programme_id' => $defaults['programme_id'] ?? null,
                    'pif_id' => $defaults['pif_id'] ?? null,
                    'work_date' => $key,
                    'hours' => $entryHours,
                    'overtime_hours' => 0,
                    'description' => $defaults['description'] ?? ($template->donor_name
                        ? $template->donor_name.' — '.$template->name
                        : $template->name),
                    'source_type' => 'manual',
                    'is_locked' => false,
                ]);
                $total += $entryHours;
            }

            $timesheet->update([
                'total_hours' => round($total, 2),
                'overtime_hours' => 0,
            ]);

            $this->timesheetService->syncTimesheetDays($timesheet->fresh(), $user);
            $this->timesheetService->audit($timesheet, $user, 'timesheet.template_applied', null, [
                'template_id' => $template->id,
                'template_code' => $template->code,
            ]);

            return $timesheet->fresh(['entries.project', 'user', 'days']);
        });
    }

    public function export(Timesheet $timesheet, User $actor, string $format = 'csv'): Response|StreamedResponse
    {
        $this->assertCanExport($timesheet, $actor);
        $timesheet->loadMissing(['user.department', 'entries.project', 'approver']);

        return match ($format) {
            'pdf' => $this->pdf($timesheet, $actor),
            'excel', 'xlsx', 'csv' => $this->csv($timesheet, $actor, $format === 'excel' || $format === 'xlsx'),
            default => throw ValidationException::withMessages(['format' => 'Supported formats: pdf, csv, excel.']),
        };
    }

    private function assertCanExport(Timesheet $timesheet, User $actor): void
    {
        $isOwner = (int) $timesheet->user_id === (int) $actor->id;
        $canExport = $actor->can('timesheets.export')
            || $actor->can('hr.admin')
            || $actor->can('hr.approve')
            || $actor->can('reports.export')
            || $actor->isSystemAdmin();

        if (! $isOwner && ! $canExport) {
            abort(403);
        }
    }

    private function pdf(Timesheet $timesheet, User $actor): Response
    {
        $pdf = Pdf::loadView('pdf.timesheet_period', [
            'timesheet' => $timesheet,
            'generatedBy' => $actor,
            'generatedAt' => now(),
        ])->setPaper('a4');

        $filename = 'timesheet-'.$timesheet->id.'-'.$timesheet->week_start->format('Ymd').'.pdf';

        return $pdf->download($filename);
    }

    private function csv(Timesheet $timesheet, User $actor, bool $excelFriendly = false): StreamedResponse
    {
        $filename = 'timesheet-'.$timesheet->id.'-'.$timesheet->week_start->format('Ymd').'.csv';

        return response()->streamDownload(function () use ($timesheet, $actor) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'employee', 'employee_id', 'department', 'week_start', 'week_end', 'status',
                'work_date', 'hours', 'overtime_hours', 'project', 'work_bucket', 'activity_type',
                'entry_category', 'description', 'source_type',
                'generated_by', 'generated_at', 'confidentiality',
            ]);
            foreach ($timesheet->entries as $entry) {
                fputcsv($out, [
                    $timesheet->user?->name,
                    $timesheet->user_id,
                    $timesheet->user?->department?->name,
                    $timesheet->week_start?->toDateString(),
                    $timesheet->week_end?->toDateString(),
                    $timesheet->status,
                    $entry->work_date?->toDateString(),
                    $entry->hours,
                    $entry->overtime_hours,
                    $entry->project?->label,
                    $entry->work_bucket,
                    $entry->activity_type,
                    $entry->entry_category,
                    $entry->description,
                    $entry->source_type,
                    $actor->name,
                    now()->toIso8601String(),
                    'internal',
                ]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'X-Timesheet-Export' => $excelFriendly ? 'excel-csv' : 'csv',
        ]);
    }
}
