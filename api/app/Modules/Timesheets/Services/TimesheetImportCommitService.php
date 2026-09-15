<?php

namespace App\Modules\Timesheets\Services;

use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TimesheetHistoricalVerification;
use App\Models\TimesheetImportBatch;
use App\Models\TimesheetImportRow;
use App\Models\TimesheetProject;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TimesheetImportCommitService
{
    public function __construct(
        private readonly TimesheetImportService $imports,
        private readonly NotificationService $notifications,
    ) {}

    public function confirm(TimesheetImportBatch $batch, User $actor, bool $importValidOnly = true, ?string $idempotencyKey = null): TimesheetImportBatch
    {
        $this->imports->assertCanImport($actor, $batch->mode);
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);

        if ($idempotencyKey && $batch->idempotency_key === $idempotencyKey && in_array($batch->status, [TimesheetImportBatch::STATUS_IMPORTED, TimesheetImportBatch::STATUS_PARTIAL, TimesheetImportBatch::STATUS_VERIFIED], true)) {
            return $batch;
        }

        if (in_array($batch->status, [TimesheetImportBatch::STATUS_IMPORTED, TimesheetImportBatch::STATUS_PARTIAL, TimesheetImportBatch::STATUS_VERIFIED], true)) {
            return $batch;
        }

        if ($batch->status !== TimesheetImportBatch::STATUS_PREVIEW_READY) {
            throw ValidationException::withMessages(['status' => 'Confirm the import only after preview is ready.']);
        }

        if (! $importValidOnly) {
            $blocking = TimesheetImportRow::query()
                ->where('import_batch_id', $batch->id)
                ->whereIn('row_status', [TimesheetImportRow::STATUS_ERROR, TimesheetImportRow::STATUS_DUPLICATE])
                ->exists();
            if ($blocking) {
                throw ValidationException::withMessages(['rows' => 'Resolve error and duplicate rows before importing everything, or import valid records only.']);
            }
        }

        $batch->update([
            'status' => TimesheetImportBatch::STATUS_PROCESSING,
            'progress_step' => 'creating_records',
            'import_valid_only' => $importValidOnly,
            'idempotency_key' => $idempotencyKey ?: $batch->idempotency_key,
            'confirmed_by' => $actor->id,
            'confirmed_at' => now(),
        ]);

        return $this->commit($batch->fresh(), $actor);
    }

    public function commit(TimesheetImportBatch $batch, User $actor): TimesheetImportBatch
    {
        $importable = TimesheetImportRow::query()
            ->where('import_batch_id', $batch->id)
            ->whereIn('row_status', [TimesheetImportRow::STATUS_VALID, TimesheetImportRow::STATUS_WARNING])
            ->orderBy('source_row_number')
            ->orderBy('split_index')
            ->get();

        $projects = TimesheetProject::query()->where('tenant_id', $batch->tenant_id)->get()
            ->keyBy(fn ($p) => mb_strtolower((string) $p->label));

        $imported = 0;
        $sheetIds = [];

        DB::transaction(function () use ($batch, $importable, $projects, $actor, &$imported, &$sheetIds) {
            foreach ($importable as $row) {
                if ($row->timesheet_entry_id) {
                    $imported++;
                    continue;
                }
                if (! $row->mapped_user_id) {
                    continue;
                }
                $norm = $row->normalised ?? [];
                $workDate = $norm['work_date'] ?? null;
                if (! $workDate) {
                    continue;
                }
                if (TimesheetEntry::query()->where('row_fingerprint', $row->row_fingerprint)->whereNull('reversed_at')->exists()) {
                    $row->update(['row_status' => TimesheetImportRow::STATUS_DUPLICATE]);
                    continue;
                }

                $weekStart = Carbon::parse($workDate)->startOfWeek(Carbon::MONDAY);
                $weekEnd = $weekStart->copy()->addDays(6);
                $sheet = Timesheet::query()
                    ->where('user_id', $row->mapped_user_id)
                    ->where('week_start', $weekStart->toDateString())
                    ->lockForUpdate()
                    ->first();

                if ($sheet && $sheet->origin !== 'historical_import') {
                    $row->update([
                        'row_status' => TimesheetImportRow::STATUS_ERROR,
                        'messages' => array_merge($row->messages ?? [], [[
                            'severity' => 'error',
                            'code' => 'live_week',
                            'message' => 'A Nexus timesheet already exists for this week.',
                        ]]),
                    ]);
                    continue;
                }

                $verified = $batch->import_as_verified;
                if (! $sheet) {
                    $sheet = Timesheet::create([
                        'tenant_id' => $batch->tenant_id,
                        'user_id' => $row->mapped_user_id,
                        'week_start' => $weekStart->toDateString(),
                        'week_end' => $weekEnd->toDateString(),
                        'week_number' => $weekStart->isoWeek(),
                        'total_hours' => 0,
                        'overtime_hours' => 0,
                        'status' => $verified ? 'verified_historical' : 'imported',
                        'origin' => 'historical_import',
                    ]);
                }

                $projectId = null;
                $projectLabel = mb_strtolower(trim((string) ($norm['project'] ?? '')));
                if ($projectLabel !== '' && $projects->has($projectLabel)) {
                    $projectId = $projects->get($projectLabel)->id;
                }

                $hours = (float) ($norm['hours'] ?? 0);
                $overtime = (float) ($norm['overtime_hours'] ?? 0);
                $sourceType = $batch->source_type ?: TimesheetEntry::SOURCE_LEGACY_IMPORT;

                $entry = TimesheetEntry::create([
                    'timesheet_id' => $sheet->id,
                    'project_id' => $projectId,
                    'activity_type' => $norm['activity'] ?? 'Legacy / Unmapped Workplan Activity',
                    'work_date' => $workDate,
                    'start_time' => $this->sqlTime($norm['start_time'] ?? null),
                    'end_time' => $this->sqlTime($norm['end_time'] ?? null),
                    'hours' => $hours,
                    'overtime_hours' => $overtime,
                    'description' => $norm['description'] ?? '',
                    'source_type' => $sourceType,
                    'is_locked' => true,
                    'import_batch_id' => $batch->id,
                    'source_row_id' => $row->id,
                    'row_fingerprint' => $row->row_fingerprint,
                    'original_project' => $norm['project'] ?? null,
                    'original_activity' => $norm['activity'] ?? null,
                    'original_description' => $norm['description'] ?? null,
                    'original_start' => trim(($norm['start_date'] ?? '').' '.($norm['start_time'] ?? '')),
                    'original_end' => trim(($norm['end_date'] ?? '').' '.($norm['end_time'] ?? '')),
                    'original_duration' => $norm['duration_h'] ?? ($norm['hours'] ?? null),
                    'original_created_date' => $norm['original_created_date'] ?? null,
                    'source_employee_name' => $row->source_employee_name,
                    'source_employee_email' => $row->source_employee_email,
                    'source_filename' => $batch->filename,
                    'source_row_number' => $row->source_row_number,
                    'external_reference' => $norm['external_reference'] ?? null,
                    'clockify_metadata' => array_filter([
                        'billable' => $norm['billable'] ?? null,
                        'billable_rate' => $norm['billable_rate'] ?? null,
                        'billable_amount' => $norm['billable_amount'] ?? null,
                        'group' => $norm['group'] ?? null,
                        'tags' => $norm['tags'] ?? null,
                    ], fn ($v) => $v !== null && $v !== ''),
                ]);

                $row->update([
                    'timesheet_id' => $sheet->id,
                    'timesheet_entry_id' => $entry->id,
                ]);
                $sheetIds[$sheet->id] = true;
                $imported++;
            }

            foreach (array_keys($sheetIds) as $sheetId) {
                $sheet = Timesheet::query()->find($sheetId);
                if (! $sheet) {
                    continue;
                }
                $entries = $sheet->entries()->whereNull('reversed_at');
                $sheet->update([
                    'total_hours' => (float) $entries->sum('hours'),
                    'overtime_hours' => (float) $entries->sum('overtime_hours'),
                ]);
            }

            if ($batch->import_as_verified) {
                TimesheetHistoricalVerification::create([
                    'tenant_id' => $batch->tenant_id,
                    'import_batch_id' => $batch->id,
                    'scope' => TimesheetHistoricalVerification::SCOPE_BATCH,
                    'justification' => $batch->verify_justification ?: 'Imported as verified historical records.',
                    'verified_by' => $actor->id,
                    'verified_at' => now(),
                ]);
                Timesheet::query()->whereIn('id', array_keys($sheetIds))->update([
                    'status' => 'verified_historical',
                    'approved_at' => now(),
                    'approved_by' => $actor->id,
                ]);
            }
        });

        $this->refreshImportedCounts($batch);
        $errorRemain = TimesheetImportRow::query()
            ->where('import_batch_id', $batch->id)
            ->whereIn('row_status', [TimesheetImportRow::STATUS_ERROR, TimesheetImportRow::STATUS_DUPLICATE])
            ->exists();
        $status = $batch->import_as_verified
            ? TimesheetImportBatch::STATUS_VERIFIED
            : ($errorRemain && $imported > 0 ? TimesheetImportBatch::STATUS_PARTIAL : TimesheetImportBatch::STATUS_IMPORTED);
        if ($imported === 0 && $errorRemain) {
            $status = TimesheetImportBatch::STATUS_PARTIAL;
        }

        $batch->update([
            'imported_rows' => $imported,
            'status' => $status,
            'progress_step' => 'finalising',
            'verified_by' => $batch->import_as_verified ? $actor->id : $batch->verified_by,
            'verified_at' => $batch->import_as_verified ? now() : $batch->verified_at,
        ]);

        $this->imports->auditBatch($batch, $actor, 'timesheet.import.confirmed', [
            'imported' => $imported,
            'status' => $status,
        ]);

        $this->notify($batch, $actor, $imported, $errorRemain);

        return $batch->fresh();
    }

    public function verify(TimesheetImportBatch $batch, User $actor, string $justification, ?int $userId = null, ?string $periodStart = null, ?string $periodEnd = null): TimesheetImportBatch
    {
        abort_unless($actor->can('timesheets.import-verify') || $actor->can('timesheets.admin'), 403);
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);
        if (! in_array($batch->status, [TimesheetImportBatch::STATUS_IMPORTED, TimesheetImportBatch::STATUS_PARTIAL], true)) {
            throw ValidationException::withMessages(['status' => 'Only imported batches can be verified.']);
        }
        if (trim($justification) === '') {
            throw ValidationException::withMessages(['justification' => 'A justification is required.']);
        }

        TimesheetHistoricalVerification::create([
            'tenant_id' => $batch->tenant_id,
            'import_batch_id' => $batch->id,
            'user_id' => $userId,
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'scope' => $userId ? TimesheetHistoricalVerification::SCOPE_EMPLOYEE_PERIOD : TimesheetHistoricalVerification::SCOPE_BATCH,
            'justification' => $justification,
            'verified_by' => $actor->id,
            'verified_at' => now(),
        ]);

        $entryQuery = TimesheetEntry::query()->where('import_batch_id', $batch->id)->whereNull('reversed_at');
        if ($userId) {
            $entryQuery->whereHas('timesheet', fn ($q) => $q->where('user_id', $userId));
        }
        $sheetIds = $entryQuery->pluck('timesheet_id')->unique()->all();
        Timesheet::query()->whereIn('id', $sheetIds)->where('origin', 'historical_import')->update([
            'status' => 'verified_historical',
            'approved_at' => now(),
            'approved_by' => $actor->id,
        ]);

        $remaining = Timesheet::query()
            ->where('origin', 'historical_import')
            ->whereIn('id', TimesheetEntry::query()->where('import_batch_id', $batch->id)->whereNull('reversed_at')->pluck('timesheet_id'))
            ->where('status', 'imported')
            ->exists();

        $batch->update([
            'status' => $remaining ? TimesheetImportBatch::STATUS_PARTIAL : TimesheetImportBatch::STATUS_VERIFIED,
            'verified_by' => $actor->id,
            'verified_at' => now(),
            'verify_justification' => $justification,
        ]);

        $this->imports->auditBatch($batch, $actor, 'timesheet.import.verified', ['justification' => $justification]);
        $this->notifications->dispatch($batch->uploader ?: $actor, 'timesheet.import.verified', [
            'reference' => $batch->reference,
            'filename' => $batch->filename,
        ], ['module' => 'timesheets', 'idempotency_key' => 'ts-imp-verified-'.$batch->id]);

        return $batch->fresh();
    }

    public function rollback(TimesheetImportBatch $batch, User $actor, string $reason): TimesheetImportBatch
    {
        abort_unless($actor->can('timesheets.import-rollback') || $actor->can('timesheets.admin'), 403);
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);
        if ($batch->status === TimesheetImportBatch::STATUS_VERIFIED) {
            throw ValidationException::withMessages(['status' => 'Verified batches cannot be rolled back. Use a controlled reversal.']);
        }
        if (! $batch->canRollback() && $batch->status !== TimesheetImportBatch::STATUS_PROCESSING) {
            throw ValidationException::withMessages(['status' => 'This batch cannot be rolled back.']);
        }

        DB::transaction(function () use ($batch) {
            $sheetIds = TimesheetEntry::query()->where('import_batch_id', $batch->id)->pluck('timesheet_id')->unique()->all();
            TimesheetEntry::query()->where('import_batch_id', $batch->id)->delete();
            foreach ($sheetIds as $sheetId) {
                $sheet = Timesheet::query()->find($sheetId);
                if (! $sheet) {
                    continue;
                }
                if ($sheet->origin === 'historical_import' && $sheet->entries()->count() === 0) {
                    $sheet->delete();
                } else {
                    $sheet->update([
                        'total_hours' => (float) $sheet->entries()->whereNull('reversed_at')->sum('hours'),
                        'overtime_hours' => (float) $sheet->entries()->whereNull('reversed_at')->sum('overtime_hours'),
                    ]);
                }
            }
            TimesheetImportRow::query()->where('import_batch_id', $batch->id)->update([
                'timesheet_id' => null,
                'timesheet_entry_id' => null,
            ]);
        });

        $batch->update([
            'status' => TimesheetImportBatch::STATUS_ROLLED_BACK,
            'rollback_by' => $actor->id,
            'rollback_at' => now(),
            'rollback_reason' => $reason,
            'imported_rows' => 0,
        ]);

        $this->imports->auditBatch($batch, $actor, 'timesheet.import.rolled_back', ['reason' => $reason]);

        return $batch->fresh();
    }

    public function reverse(TimesheetImportBatch $batch, User $actor, string $reason): TimesheetImportBatch
    {
        abort_unless($actor->can('timesheets.import-rollback') || $actor->can('timesheets.admin'), 403);
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);
        if ($batch->status !== TimesheetImportBatch::STATUS_VERIFIED) {
            throw ValidationException::withMessages(['status' => 'Only verified batches require a controlled reversal.']);
        }
        if (trim($reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required to reverse a verified batch.']);
        }

        TimesheetEntry::query()->where('import_batch_id', $batch->id)->whereNull('reversed_at')->update([
            'reversed_at' => now(),
        ]);
        $sheetIds = TimesheetEntry::query()->where('import_batch_id', $batch->id)->pluck('timesheet_id')->unique();
        foreach ($sheetIds as $sheetId) {
            $sheet = Timesheet::query()->find($sheetId);
            if (! $sheet) {
                continue;
            }
            $sheet->update([
                'total_hours' => (float) $sheet->entries()->whereNull('reversed_at')->sum('hours'),
                'overtime_hours' => (float) $sheet->entries()->whereNull('reversed_at')->sum('overtime_hours'),
            ]);
        }

        $batch->update([
            'status' => TimesheetImportBatch::STATUS_REVERSED,
            'reversed_by' => $actor->id,
            'reversed_at' => now(),
            'reverse_reason' => $reason,
        ]);

        $this->imports->auditBatch($batch, $actor, 'timesheet.import.reversed', ['reason' => $reason]);

        return $batch->fresh();
    }

    private function sqlTime(?string $time): ?string
    {
        if (! $time) {
            return null;
        }
        if ($time === '24:00:00') {
            return '23:59:59';
        }

        return $time;
    }

    private function refreshImportedCounts(TimesheetImportBatch $batch): void
    {
        $batch->valid_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_VALID)->count();
        $batch->warning_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_WARNING)->count();
        $batch->error_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_ERROR)->count();
        $batch->duplicate_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_DUPLICATE)->count();
        $batch->save();
    }

    private function notify(TimesheetImportBatch $batch, User $actor, int $imported, bool $hasErrors): void
    {
        $recipient = $batch->uploader ?: $actor;
        $vars = [
            'reference' => $batch->reference,
            'filename' => $batch->filename,
            'imported' => $imported,
            'errors' => $batch->error_rows,
        ];
        $this->notifications->dispatch($recipient, $hasErrors ? 'timesheet.import.errors' : 'timesheet.import.completed', $vars, [
            'module' => 'timesheets',
            'idempotency_key' => 'ts-imp-done-'.$batch->id,
        ]);
        if (! $batch->import_as_verified && $imported > 0) {
            $this->notifications->dispatch($recipient, 'timesheet.import.verification_required', $vars, [
                'module' => 'timesheets',
                'idempotency_key' => 'ts-imp-verify-'.$batch->id,
            ]);
        }
    }
}
