<?php

namespace App\Modules\Timesheets\Services;

use App\Models\OvertimeSettlement;
use App\Models\PayrollExportBatch;
use App\Models\PayrollExportLine;
use App\Models\Timesheet;
use App\Models\TimesheetAuditEvent;
use App\Models\TimesheetPeriod;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Stage payroll export packages from HR-validated/approved timesheets.
 * Respects pay XOR TOIL — TOIL hours never contribute to payable_hours.
 * Does not invent overtime rates.
 */
class TimesheetPayrollExportService
{
    public function stageFromPeriod(
        User $actor,
        int $periodId,
        ?string $idempotencyKey = null,
        bool $markIncluded = true,
    ): PayrollExportBatch {
        $this->assertCanStage($actor);

        $period = TimesheetPeriod::query()
            ->where('tenant_id', $actor->tenant_id)
            ->findOrFail($periodId);

        $key = $idempotencyKey ?: ('ts-payroll-'.$period->id.'|'.$actor->tenant_id);

        $existing = PayrollExportBatch::where('idempotency_key', $key)->first();
        if ($existing) {
            return $existing->load(['lines.user', 'period']);
        }

        $timesheets = Timesheet::query()
            ->with('user')
            ->where('tenant_id', $actor->tenant_id)
            ->where('period_id', $period->id)
            ->where('status', 'approved')
            ->whereNotNull('hr_validated_at')
            ->orderBy('user_id')
            ->get();

        if ($timesheets->isEmpty()) {
            throw ValidationException::withMessages([
                'period_id' => 'No HR-validated approved timesheets found for this period.',
            ]);
        }

        return DB::transaction(function () use ($actor, $period, $timesheets, $key, $markIncluded) {
            $batch = PayrollExportBatch::create([
                'tenant_id' => $actor->tenant_id,
                'batch_reference' => 'PAY-TS-'.strtoupper(Str::random(6)),
                'period_id' => $period->id,
                'status' => PayrollExportBatch::EXPORTED,
                'exported_by' => $actor->id,
                'exported_at' => now(),
                'idempotency_key' => $key,
            ]);

            $userIds = $timesheets->pluck('user_id')->unique()->all();

            foreach ($timesheets as $timesheet) {
                $ordinaryHours = (float) $timesheet->total_hours;
                PayrollExportLine::create([
                    'batch_id' => $batch->id,
                    'overtime_settlement_id' => null,
                    'timesheet_id' => $timesheet->id,
                    'user_id' => $timesheet->user_id,
                    'employee_number' => $timesheet->user?->employee_number,
                    'hours' => $ordinaryHours,
                    'payable_hours' => $ordinaryHours,
                    'day_type' => 'ordinary',
                    'settlement_flag' => 'ordinary',
                    'period_start' => $timesheet->week_start,
                    'period_end' => $timesheet->week_end,
                ]);

                if ($markIncluded) {
                    $timesheet->update(['payroll_export_batch_id' => $batch->id]);
                }
            }

            $settlements = OvertimeSettlement::query()
                ->with(['actual', 'user'])
                ->where('tenant_id', $actor->tenant_id)
                ->whereIn('user_id', $userIds)
                ->whereIn('settlement_type', [OvertimeSettlement::TYPE_PAY, OvertimeSettlement::TYPE_TOIL])
                ->where('status', '!=', OvertimeSettlement::CANCELLED)
                ->whereHas('actual', function ($q) use ($period) {
                    $q->whereBetween('work_date', [
                        $period->period_start->toDateString(),
                        $period->period_end->toDateString(),
                    ]);
                })
                ->get();

            foreach ($settlements as $settlement) {
                $isPay = $settlement->settlement_type === OvertimeSettlement::TYPE_PAY;
                $timesheetId = $timesheets->firstWhere('user_id', $settlement->user_id)?->id;

                $line = PayrollExportLine::firstOrCreate(
                    [
                        'batch_id' => $batch->id,
                        'overtime_settlement_id' => $settlement->id,
                    ],
                    [
                        'timesheet_id' => $timesheetId,
                        'user_id' => $settlement->user_id,
                        'employee_number' => $settlement->user?->employee_number,
                        'hours' => $settlement->hours,
                        // TOIL: never contribute payable hours
                        'payable_hours' => $isPay ? (float) ($settlement->payable_hours ?? $settlement->hours) : 0,
                        'day_type' => $settlement->actual?->day_type,
                        'settlement_flag' => $isPay ? 'pay' : 'toil',
                        'period_start' => $period->period_start,
                        'period_end' => $period->period_end,
                    ]
                );

                if ($isPay && $settlement->status === OvertimeSettlement::PENDING) {
                    $settlement->update([
                        'status' => OvertimeSettlement::SENT,
                        'payroll_export_line_id' => $line->id,
                    ]);
                }
            }

            TimesheetAuditEvent::create([
                'tenant_id' => $actor->tenant_id,
                'actor_id' => $actor->id,
                'event_type' => 'timesheet.payroll.exported',
                'new_values' => [
                    'batch_id' => $batch->id,
                    'period_id' => $period->id,
                    'timesheet_ids' => $timesheets->pluck('id')->all(),
                ],
            ]);

            return $batch->load(['lines.user', 'period']);
        });
    }

    public function exportCsv(PayrollExportBatch $batch): string
    {
        $batch->loadMissing(['lines.user', 'period']);
        $out = fopen('php://temp', 'r+');
        fputcsv($out, [
            'employee_id',
            'employee_name',
            'period_start',
            'period_end',
            'hours',
            'payable_hours',
            'pay_vs_toil',
            'batch_reference',
        ]);

        foreach ($batch->lines as $line) {
            fputcsv($out, [
                $line->employee_number ?: (string) $line->user_id,
                $line->user?->name,
                optional($line->period_start)->toDateString()
                    ?? optional($batch->period?->period_start)->toDateString(),
                optional($line->period_end)->toDateString()
                    ?? optional($batch->period?->period_end)->toDateString(),
                $line->hours,
                $line->payable_hours ?? 0,
                $line->settlement_flag ?? 'ordinary',
                $batch->batch_reference,
            ]);
        }

        rewind($out);
        $csv = stream_get_contents($out) ?: '';
        fclose($out);

        return $csv;
    }

    public function download(PayrollExportBatch $batch, User $actor, string $format = 'csv'): StreamedResponse
    {
        $this->assertCanStage($actor);
        if ((int) $batch->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $filename = 'payroll-'.$batch->batch_reference.'.'.($format === 'xlsx' || $format === 'excel' ? 'xlsx' : 'csv');

        if (in_array($format, ['xlsx', 'excel'], true)) {
            return response()->streamDownload(function () use ($batch) {
                $batch->loadMissing(['lines.user', 'period']);
                $writer = new XlsxWriter();
                $writer->openToFile('php://output');
                $writer->addRow(Row::fromValues([
                    'employee_id', 'employee_name', 'period_start', 'period_end',
                    'hours', 'payable_hours', 'pay_vs_toil', 'batch_reference',
                ]));
                foreach ($batch->lines as $line) {
                    $writer->addRow(Row::fromValues([
                        $line->employee_number ?: (string) $line->user_id,
                        $line->user?->name,
                        optional($line->period_start)->toDateString()
                            ?? optional($batch->period?->period_start)->toDateString(),
                        optional($line->period_end)->toDateString()
                            ?? optional($batch->period?->period_end)->toDateString(),
                        (float) $line->hours,
                        (float) ($line->payable_hours ?? 0),
                        $line->settlement_flag ?? 'ordinary',
                        $batch->batch_reference,
                    ]));
                }
                $writer->close();
            }, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]);
        }

        $csv = $this->exportCsv($batch);

        return response()->streamDownload(function () use ($csv) {
            echo $csv;
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function assertCanStage(User $actor): void
    {
        $allowed = $actor->can('timesheets.export')
            || $actor->can('hr.admin')
            || $actor->can('hr.approve')
            || $actor->can('finance.approve')
            || $actor->can('finance.admin')
            || $actor->hasAnyRole(['HR Administrator', 'Finance Controller', 'System Admin', 'super-admin'])
            || $actor->isSystemAdmin();

        if (! $allowed) {
            abort(403);
        }
    }
}
