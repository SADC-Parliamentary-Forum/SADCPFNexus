<?php

namespace App\Modules\Timesheets\Services;

use App\Models\LeaveRequest;
use App\Models\Timesheet;
use App\Models\TimesheetAuditEvent;
use App\Models\TimesheetEntry;
use App\Models\TimesheetImportBatch;
use App\Models\TimesheetImportMapping;
use App\Models\TimesheetImportRow;
use App\Models\TimesheetImportTemplate;
use App\Models\TimesheetProject;
use App\Models\User;
use App\Modules\Documents\Drivers\MalwareScannerFactory;
use App\Modules\Timesheets\Import\ClockifyDetailedReportAdapter;
use App\Modules\Timesheets\Import\CustomColumnMapAdapter;
use App\Modules\Timesheets\Import\NexusTimesheetTemplateAdapter;
use App\Modules\Timesheets\Import\NexusTimesheetTemplateWorkbook;
use App\Modules\Timesheets\Import\TimesheetCsvSanitizer;
use App\Modules\Timesheets\Import\TimesheetFormatDetector;
use App\Modules\Timesheets\Import\TimesheetImportAdapterInterface;
use App\Modules\Timesheets\Import\TimesheetMidnightSplitter;
use App\Modules\Timesheets\Import\TimesheetRowFingerprint;
use App\Modules\Timesheets\Import\TimesheetSpreadsheetLoader;
use App\Support\UploadContentSniffer;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetImportService
{
    public const MAX_BYTES = 20 * 1024 * 1024;

    public function __construct(
        private readonly TimesheetService $timesheets,
        private readonly MalwareScannerFactory $scanners,
    ) {}

    public function assertCanImport(User $actor, string $mode): void
    {
        $allowed = match ($mode) {
            TimesheetImportBatch::MODE_SELF => $actor->can('timesheets.import-own'),
            TimesheetImportBatch::MODE_SINGLE => $actor->can('timesheets.import-single') || $actor->can('timesheets.admin'),
            TimesheetImportBatch::MODE_MULTI => $actor->can('timesheets.import-multi') || $actor->can('timesheets.admin'),
            default => false,
        };
        if (! $allowed) {
            abort(403, 'You are not permitted to import timesheets in this mode.');
        }
        if ($mode === TimesheetImportBatch::MODE_SELF && ! $actor->is_active) {
            abort(403, 'Inactive employees cannot import timesheets.');
        }
    }

    public function templateBinary(?User $actor = null): array
    {
        if ($actor) {
            $stored = TimesheetImportTemplate::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('is_current', true)
                ->orderByDesc('version')
                ->first();
            if ($stored && Storage::disk('local')->exists($stored->storage_path)) {
                return [
                    'binary' => (string) Storage::disk('local')->get($stored->storage_path),
                    'filename' => $stored->filename,
                ];
            }
        }

        $path = sys_get_temp_dir().'/'.uniqid('ts-tpl-', true).'.xlsx';
        try {
            (new NexusTimesheetTemplateWorkbook)->write($path);
            $binary = (string) file_get_contents($path);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }

        return ['binary' => $binary, 'filename' => NexusTimesheetTemplateWorkbook::FILENAME];
    }

    public function ingest(
        UploadedFile $file,
        User $actor,
        string $mode,
        ?int $targetUserId = null,
        bool $importAsVerified = false,
        ?string $justification = null,
    ): TimesheetImportBatch {
        $this->assertCanImport($actor, $mode);

        if ($importAsVerified) {
            abort_unless(
                $actor->can('timesheets.import-verify') || $actor->can('timesheets.admin'),
                403,
                'You cannot import as verified historical records.',
            );
            abort_unless($mode !== TimesheetImportBatch::MODE_SELF, 403, 'Self-import cannot mark records as verified.');
            if (! is_string($justification) || trim($justification) === '') {
                throw ValidationException::withMessages(['justification' => 'A justification is required to import as verified historical records.']);
            }
        }

        if ($mode === TimesheetImportBatch::MODE_SINGLE && ! $targetUserId) {
            throw ValidationException::withMessages(['target_user_id' => 'Select the employee these timesheets belong to.']);
        }
        if ($mode === TimesheetImportBatch::MODE_SELF) {
            $targetUserId = $actor->id;
        }

        $extension = strtolower($file->getClientOriginalExtension() ?: '');
        if (! in_array($extension, ['csv', 'xlsx'], true)) {
            throw ValidationException::withMessages(['file' => 'Upload a CSV or XLSX file.']);
        }
        if ($file->getSize() > self::MAX_BYTES) {
            throw ValidationException::withMessages(['file' => 'The file exceeds the 20 MB limit.']);
        }

        $mime = UploadContentSniffer::assertAllowed($file, [
            'text/plain', 'text/csv', 'application/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'application/octet-stream',
        ]);

        $contents = file_get_contents($file->getRealPath() ?: '');
        if ($contents === false || $contents === '') {
            throw ValidationException::withMessages(['file' => 'The file is empty.']);
        }
        $hash = hash('sha256', $contents);

        $existing = TimesheetImportBatch::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('file_hash', $hash)
            ->where('mode', $mode)
            ->where(function ($q) use ($targetUserId) {
                if ($targetUserId) {
                    $q->where('target_user_id', $targetUserId);
                } else {
                    $q->whereNull('target_user_id');
                }
            })
            ->whereNotIn('status', [TimesheetImportBatch::STATUS_ROLLED_BACK, TimesheetImportBatch::STATUS_REVERSED])
            ->orderByDesc('id')
            ->first();
        if ($existing) {
            return $existing;
        }

        $batch = DB::transaction(function () use ($actor, $file, $hash, $mime, $mode, $targetUserId, $importAsVerified, $justification) {
            return TimesheetImportBatch::create([
                'tenant_id' => $actor->tenant_id,
                'reference' => $this->nextReference((int) $actor->tenant_id),
                'filename' => $file->getClientOriginalName(),
                'file_hash' => $hash,
                'detected_mime' => $mime,
                'mode' => $mode,
                'target_user_id' => $targetUserId,
                'status' => TimesheetImportBatch::STATUS_UPLOADED,
                'progress_step' => 'reading_file',
                'import_as_verified' => $importAsVerified,
                'verify_justification' => $justification,
                'uploaded_by' => $actor->id,
                'uploaded_at' => now(),
            ]);
        });

        $storageKey = sprintf('timesheet-imports/%s/%s/%s.%s', $actor->tenant_id, $batch->id, $hash, $extension);
        Storage::disk('local')->put($storageKey, $contents);
        $absolute = Storage::disk('local')->path($storageKey);
        $scan = $this->scanners->make()->scan($absolute, 'local', $storageKey);
        if (($scan['status'] ?? '') === 'infected') {
            Storage::disk('local')->delete($storageKey);
            $batch->delete();
            throw ValidationException::withMessages(['file' => 'Upload rejected by malware scan.']);
        }

        $batch->update(['file_storage_key' => $storageKey, 'file_size_bytes' => strlen($contents)]);

        $this->auditBatch($batch, $actor, 'timesheet.import.uploaded', [
            'batch_id' => $batch->id,
            'reference' => $batch->reference,
            'mode' => $mode,
        ]);

        return $batch->fresh();
    }

    public function processStaging(TimesheetImportBatch $batch): TimesheetImportBatch
    {
        $batch->update([
            'status' => TimesheetImportBatch::STATUS_DETECTING,
            'progress_step' => 'reading_file',
        ]);

        $path = Storage::disk('local')->path($batch->file_storage_key);
        $extension = strtolower(pathinfo($batch->filename, PATHINFO_EXTENSION));
        $grid = TimesheetSpreadsheetLoader::load($path, $extension);
        if ($grid === []) {
            $batch->update([
                'status' => TimesheetImportBatch::STATUS_FAILED,
                'failure_reason' => 'The file contained no rows.',
            ]);

            return $batch->fresh();
        }

        $headers = array_map(fn ($h) => is_string($h) ? $h : (string) $h, $grid[0]);
        $detected = TimesheetFormatDetector::detect($headers);
        $adapter = $this->adapterFor($detected['format']);
        $sourceType = match ($detected['format']) {
            TimesheetFormatDetector::FORMAT_CLOCKIFY => TimesheetEntry::SOURCE_CLOCKIFY_IMPORT,
            TimesheetFormatDetector::FORMAT_NEXUS => TimesheetEntry::SOURCE_NEXUS_TEMPLATE_IMPORT,
            default => TimesheetEntry::SOURCE_LEGACY_IMPORT,
        };
        if ($batch->mode !== TimesheetImportBatch::MODE_SELF && $sourceType === TimesheetEntry::SOURCE_NEXUS_TEMPLATE_IMPORT) {
            $sourceType = TimesheetEntry::SOURCE_ADMIN_IMPORT;
        }

        $batch->update([
            'format' => $detected['format'],
            'source_type' => $sourceType,
            'detected_headers' => $headers,
            'column_map' => $batch->column_map ?: [],
            'status' => TimesheetImportBatch::STATUS_VALIDATING,
            'progress_step' => 'matching_employees',
        ]);

        TimesheetImportRow::query()->where('import_batch_id', $batch->id)->delete();

        $actor = User::query()->findOrFail($batch->uploaded_by);
        $usersByEmail = User::query()
            ->where('tenant_id', $batch->tenant_id)
            ->get(['id', 'email', 'name', 'is_active'])
            ->keyBy(fn (User $u) => strtolower((string) $u->email));
        $usersById = User::query()->where('tenant_id', $batch->tenant_id)->get(['id', 'email', 'name', 'is_active'])->keyBy('id');
        $projects = TimesheetProject::query()->where('tenant_id', $batch->tenant_id)->get()->keyBy(fn ($p) => mb_strtolower((string) $p->label));
        $mappings = TimesheetImportMapping::query()
            ->where('tenant_id', $batch->tenant_id)
            ->where('is_active', true)
            ->get()
            ->groupBy('kind');

        $seenFingerprints = [];
        $total = 0;

        $batch->update(['progress_step' => 'checking_duplicates']);

        for ($i = 1; $i < count($grid); $i++) {
            $values = $grid[$i];
            if ($this->rowEmpty($values)) {
                continue;
            }
            $mapped = $adapter->mapRow($headers, $values, $batch->column_map ?? []);
            $slices = TimesheetMidnightSplitter::split($mapped);
            foreach ($slices as $slice) {
                $total++;
                $this->stageRow($batch, $actor, $i + 1, $slice, $usersByEmail, $usersById, $projects, $mappings, $seenFingerprints);
            }
        }

        $this->refreshCounts($batch);
        $batch->update([
            'total_rows' => $total,
            'status' => TimesheetImportBatch::STATUS_PREVIEW_READY,
            'progress_step' => 'preview_ready',
        ]);

        return $batch->fresh();
    }

    public function applyMap(TimesheetImportBatch $batch, User $actor, array $columnMap, array $employeeMaps, bool $applyToAll = true): TimesheetImportBatch
    {
        $this->assertCanImport($actor, $batch->mode);
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);

        if ($columnMap !== []) {
            $batch->column_map = array_merge($batch->column_map ?? [], $columnMap);
            $batch->save();
        }

        foreach ($employeeMaps as $map) {
            $email = strtolower(trim((string) ($map['email'] ?? '')));
            $userId = (int) ($map['user_id'] ?? 0);
            if ($email === '' || $userId < 1) {
                continue;
            }
            TimesheetImportMapping::updateOrCreate(
                [
                    'tenant_id' => $batch->tenant_id,
                    'kind' => TimesheetImportMapping::KIND_EMPLOYEE_EMAIL,
                    'historical_value' => $email,
                ],
                [
                    'mapped_user_id' => $userId,
                    'nexus_value' => (string) $userId,
                    'is_active' => true,
                    'created_by' => $actor->id,
                ]
            );
            if ($applyToAll) {
                TimesheetImportRow::query()
                    ->where('import_batch_id', $batch->id)
                    ->whereRaw('LOWER(source_employee_email) = ?', [$email])
                    ->update(['mapped_user_id' => $userId]);
            }
        }

        return $this->processStaging($batch->fresh());
    }

    public function preview(TimesheetImportBatch $batch, User $actor, ?string $filter = null, int $page = 1, int $perPage = 50): array
    {
        $this->assertCanView($actor, $batch);
        $query = TimesheetImportRow::query()->where('import_batch_id', $batch->id);
        $this->applyPreviewFilter($query, $filter);
        $rows = $query->orderBy('source_row_number')->orderBy('split_index')->paginate($perPage, ['*'], 'page', $page);

        return [
            'batch' => $this->serializeBatch($batch),
            'counts' => [
                'uploaded_rows' => $batch->total_rows,
                'employees_detected' => TimesheetImportRow::query()->where('import_batch_id', $batch->id)->whereNotNull('mapped_user_id')->distinct('mapped_user_id')->count('mapped_user_id'),
                'valid_entries' => $batch->valid_rows,
                'warnings' => $batch->warning_rows,
                'errors' => $batch->error_rows,
                'possible_duplicates' => $batch->duplicate_rows,
                'imported' => $batch->imported_rows,
            ],
            'rows' => $rows,
            'unmatched_employees' => TimesheetImportRow::query()
                ->where('import_batch_id', $batch->id)
                ->whereNull('mapped_user_id')
                ->whereNotNull('source_employee_email')
                ->get(['source_employee_email', 'source_employee_name'])
                ->unique(fn ($row) => strtolower((string) $row->source_employee_email))
                ->values()
                ->map(fn ($row) => [
                    'email' => $row->source_employee_email,
                    'name' => $row->source_employee_name,
                ])
                ->all(),
        ];
    }

    public function failuresCsv(TimesheetImportBatch $batch, User $actor): StreamedResponse
    {
        $this->assertCanView($actor, $batch);
        $rows = TimesheetImportRow::query()
            ->where('import_batch_id', $batch->id)
            ->whereIn('row_status', [TimesheetImportRow::STATUS_ERROR, TimesheetImportRow::STATUS_DUPLICATE])
            ->orderBy('source_row_number')
            ->get();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['row', 'status', 'employee_email', 'date', 'message']);
            foreach ($rows as $row) {
                $norm = $row->normalised ?? [];
                $messages = collect($row->messages ?? [])->pluck('message')->implode('; ');
                fputcsv($out, [
                    TimesheetCsvSanitizer::cell((string) $row->source_row_number),
                    TimesheetCsvSanitizer::cell((string) $row->row_status),
                    TimesheetCsvSanitizer::cell((string) ($row->source_employee_email ?? '')),
                    TimesheetCsvSanitizer::cell((string) ($norm['work_date'] ?? '')),
                    TimesheetCsvSanitizer::cell($messages),
                ]);
            }
            fclose($out);
        }, $batch->reference.'-failures.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function serializeBatch(TimesheetImportBatch $batch): array
    {
        return [
            'id' => $batch->id,
            'reference' => $batch->reference,
            'filename' => $batch->filename,
            'format' => $batch->format,
            'source_type' => $batch->source_type,
            'mode' => $batch->mode,
            'target_user_id' => $batch->target_user_id,
            'status' => $batch->status,
            'progress_step' => $batch->progress_step,
            'total_rows' => $batch->total_rows,
            'valid_rows' => $batch->valid_rows,
            'warning_rows' => $batch->warning_rows,
            'error_rows' => $batch->error_rows,
            'duplicate_rows' => $batch->duplicate_rows,
            'excluded_rows' => $batch->excluded_rows,
            'imported_rows' => $batch->imported_rows,
            'detected_headers' => $batch->detected_headers,
            'column_map' => $batch->column_map,
            'failure_reason' => $batch->failure_reason,
            'uploaded_at' => $batch->uploaded_at?->toIso8601String(),
            'confirmed_at' => $batch->confirmed_at?->toIso8601String(),
            'verified_at' => $batch->verified_at?->toIso8601String(),
            'import_as_verified' => $batch->import_as_verified,
        ];
    }

    public function assertCanView(User $actor, TimesheetImportBatch $batch): void
    {
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);
        if ((int) $batch->uploaded_by === (int) $actor->id) {
            return;
        }
        abort_unless(
            $actor->can('timesheets.import-view-batches') || $actor->can('timesheets.admin') || $actor->can('timesheets.audit'),
            403
        );
    }

    private function adapterFor(string $format): TimesheetImportAdapterInterface
    {
        return match ($format) {
            TimesheetFormatDetector::FORMAT_CLOCKIFY => new ClockifyDetailedReportAdapter,
            TimesheetFormatDetector::FORMAT_NEXUS => new NexusTimesheetTemplateAdapter,
            default => new CustomColumnMapAdapter,
        };
    }

    /**
     * @param  \Illuminate\Support\Collection<string, User>  $usersByEmail
     * @param  \Illuminate\Support\Collection<int, User>  $usersById
     * @param  \Illuminate\Support\Collection<string, TimesheetProject>  $projects
     * @param  \Illuminate\Support\Collection<string, mixed>  $mappings
     * @param  array<string, true>  $seenFingerprints
     */
    private function stageRow(
        TimesheetImportBatch $batch,
        User $actor,
        int $sourceRowNumber,
        array $slice,
        $usersByEmail,
        $usersById,
        $projects,
        $mappings,
        array &$seenFingerprints,
    ): void {
        $normalised = $this->normaliseSlice($slice);
        $messages = [];
        $status = TimesheetImportRow::STATUS_VALID;
        $mappedUserId = null;

        if (! empty($slice['multi_day_ambiguous'])) {
            $messages[] = $this->msg('error', 'multi_day', 'Start and end dates span multiple days without usable times. Administrative review is required.');
            $status = TimesheetImportRow::STATUS_ERROR;
        }
        if (! empty($slice['invalid_range'])) {
            $messages[] = $this->msg('error', 'range', 'End time occurs before start time.');
            $status = TimesheetImportRow::STATUS_ERROR;
        }

        $workDate = $this->parseDate($normalised['work_date'] ?? $normalised['start_date'] ?? null);
        if ($workDate === null) {
            $messages[] = $this->msg('error', 'date', 'Date is invalid or missing.');
            $status = TimesheetImportRow::STATUS_ERROR;
        } else {
            $normalised['work_date'] = $workDate;
        }

        $hours = $this->parseHours($normalised['hours'] ?? null);
        $startTime = $this->parseTime($normalised['start_time'] ?? null);
        $endTime = $this->parseTime($normalised['end_time'] ?? null);
        if ($hours === null && $startTime && $endTime && $workDate) {
            $hours = $this->hoursFromTimes($workDate, $startTime, $endTime);
        }
        if ($hours === null || $hours <= 0) {
            $messages[] = $this->msg('error', 'hours', 'Hours must be a positive number.');
            $status = TimesheetImportRow::STATUS_ERROR;
        } elseif ($hours > 24) {
            $messages[] = $this->msg('error', 'hours', 'A single daily record cannot exceed 24 hours.');
            $status = TimesheetImportRow::STATUS_ERROR;
        } else {
            $normalised['hours'] = $hours;
        }
        $normalised['start_time'] = $startTime;
        $normalised['end_time'] = $endTime;

        $description = trim((string) ($normalised['description'] ?? ''));
        if ($description === '') {
            $messages[] = $this->msg('error', 'description', 'Description is required.');
            $status = TimesheetImportRow::STATUS_ERROR;
        }

        $identity = $this->resolveUser($batch, $actor, $normalised, $usersByEmail, $usersById, $mappings, $messages);
        if ($identity['error']) {
            $status = TimesheetImportRow::STATUS_ERROR;
        } else {
            $mappedUserId = $identity['user_id'];
        }

        $type = strtolower(trim((string) ($normalised['type'] ?? 'normal')));
        $isOvertime = str_contains($type, 'overtime');
        $normalised['type'] = $isOvertime ? 'Overtime' : 'Normal';
        $normalised['overtime_hours'] = $isOvertime ? ($hours ?? 0) : 0;
        $normalised['normal_hours'] = $isOvertime ? 0 : ($hours ?? 0);

        $projectLabel = trim((string) ($normalised['project'] ?? ''));
        if ($projectLabel !== '' && ! $projects->has(mb_strtolower($projectLabel))) {
            $messages[] = $this->msg('warning', 'unmapped_project', 'Project is not in the current Nexus catalogue and will be kept as a legacy value.');
            if ($status === TimesheetImportRow::STATUS_VALID) {
                $status = TimesheetImportRow::STATUS_WARNING;
            }
        }

        if ($workDate && $mappedUserId) {
            $carbon = Carbon::parse($workDate);
            if ($carbon->isWeekend()) {
                $messages[] = $this->msg('warning', 'weekend', 'Entry is on a weekend. This is not automatically overtime.');
                if ($status === TimesheetImportRow::STATUS_VALID) {
                    $status = TimesheetImportRow::STATUS_WARNING;
                }
            }
            $holidays = $this->timesheets->getHolidayDates($actor, $workDate, $workDate);
            if (isset($holidays[$workDate])) {
                $messages[] = $this->msg('warning', 'holiday', 'Entry falls on a public holiday.');
                if ($status === TimesheetImportRow::STATUS_VALID) {
                    $status = TimesheetImportRow::STATUS_WARNING;
                }
            }
            if ($this->hasApprovedLeave((int) $mappedUserId, $workDate)) {
                $messages[] = $this->msg('warning', 'leave', 'Work is logged during an approved leave period. Leave was not converted.');
                if ($status === TimesheetImportRow::STATUS_VALID) {
                    $status = TimesheetImportRow::STATUS_WARNING;
                }
            }

            $weekStart = $carbon->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
            $existingSheet = Timesheet::query()
                ->where('user_id', $mappedUserId)
                ->where('week_start', $weekStart)
                ->first();
            if ($existingSheet && $existingSheet->origin !== 'historical_import') {
                $messages[] = $this->msg('error', 'live_week', 'A Nexus timesheet already exists for this week.');
                $status = TimesheetImportRow::STATUS_ERROR;
            }
        }

        $fingerprint = TimesheetRowFingerprint::make((int) $batch->tenant_id, [
            'user_id' => $mappedUserId,
            'work_date' => $normalised['work_date'] ?? '',
            'start_time' => $startTime,
            'end_time' => $endTime,
            'project' => $normalised['project'] ?? '',
            'activity' => $normalised['activity'] ?? '',
            'description' => $description,
            'hours' => $hours,
        ]);
        $dup = isset($seenFingerprints[$fingerprint])
            || TimesheetEntry::query()->where('row_fingerprint', $fingerprint)->whereNull('reversed_at')->exists();
        if ($dup) {
            $messages[] = $this->msg('error', 'duplicate', 'Potential duplicate of an existing or already staged record.');
            $status = TimesheetImportRow::STATUS_DUPLICATE;
        }
        $seenFingerprints[$fingerprint] = true;

        TimesheetImportRow::create([
            'tenant_id' => $batch->tenant_id,
            'import_batch_id' => $batch->id,
            'source_row_number' => $sourceRowNumber,
            'split_index' => (int) ($slice['split_index'] ?? 0),
            'split_group' => 'src-'.$sourceRowNumber,
            'raw' => $slice,
            'normalised' => $normalised,
            'row_status' => $status,
            'messages' => $messages,
            'row_fingerprint' => $fingerprint,
            'mapped_user_id' => $mappedUserId,
            'source_employee_email' => $normalised['employee_email'] ?? null,
            'source_employee_name' => $normalised['employee_name'] ?? null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $slice
     * @return array<string, mixed>
     */
    private function normaliseSlice(array $slice): array
    {
        $out = [];
        foreach ($slice as $key => $value) {
            if (is_string($value)) {
                $out[$key] = trim($value);
            } else {
                $out[$key] = $value;
            }
        }
        if (empty($out['employee_email']) && ! empty($out['email'])) {
            $out['employee_email'] = $out['email'];
        }

        return $out;
    }

    /**
     * @param  list<array<string, string>>  $messages
     * @return array{user_id: ?int, error: bool}
     */
    private function resolveUser(TimesheetImportBatch $batch, User $actor, array $normalised, $usersByEmail, $usersById, $mappings, array &$messages): array
    {
        if ($batch->mode === TimesheetImportBatch::MODE_SELF || $batch->mode === TimesheetImportBatch::MODE_SINGLE) {
            $targetId = (int) $batch->target_user_id;
            $email = strtolower(trim((string) ($normalised['employee_email'] ?? '')));
            if ($email !== '') {
                $target = $usersById->get($targetId);
                $targetEmail = strtolower((string) ($target?->email ?? ''));
                if ($targetEmail !== '' && $email !== $targetEmail) {
                    if ($batch->mode === TimesheetImportBatch::MODE_SELF) {
                        $messages[] = $this->msg('error', 'identity', 'This file contains another employee\'s identity. Rows were not assigned to them.');
                        return ['user_id' => null, 'error' => true];
                    }
                }
            }
            $idField = trim((string) ($normalised['employee_id'] ?? ''));
            if ($idField !== '' && ctype_digit($idField) && (int) $idField !== $targetId && $batch->mode === TimesheetImportBatch::MODE_SELF) {
                $messages[] = $this->msg('error', 'identity', 'This file contains another employee\'s identity. Rows were not assigned to them.');
                return ['user_id' => null, 'error' => true];
            }

            return ['user_id' => $targetId, 'error' => false];
        }

        $idField = trim((string) ($normalised['employee_id'] ?? ''));
        if ($idField !== '' && ctype_digit($idField) && $usersById->has((int) $idField)) {
            return ['user_id' => (int) $idField, 'error' => false];
        }
        $email = strtolower(trim((string) ($normalised['employee_email'] ?? '')));
        if ($email !== '' && $usersByEmail->has($email)) {
            return ['user_id' => (int) $usersByEmail->get($email)->id, 'error' => false];
        }
        if ($email !== '') {
            $mapped = ($mappings[TimesheetImportMapping::KIND_EMPLOYEE_EMAIL] ?? collect())
                ->first(fn ($m) => strtolower((string) $m->historical_value) === $email);
            if ($mapped && $mapped->mapped_user_id) {
                return ['user_id' => (int) $mapped->mapped_user_id, 'error' => false];
            }
            $messages[] = $this->msg('error', 'unmatched', 'Employee email could not be matched. Mapping is required.');
            return ['user_id' => null, 'error' => true];
        }

        $messages[] = $this->msg('error', 'unmatched', 'Employee identity is missing. Email is required for multi-employee imports.');

        return ['user_id' => null, 'error' => true];
    }

    private function hasApprovedLeave(int $userId, string $date): bool
    {
        return LeaveRequest::query()
            ->where('requester_id', $userId)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->exists();
    }

    /**
     * @return array{severity: string, code: string, message: string}
     */
    private function msg(string $severity, string $code, string $message): array
    {
        return compact('severity', 'code', 'message');
    }

    private function parseDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance(\DateTime::createFromInterface($value))->toDateString();
        }
        $raw = trim((string) $value);
        foreach (['Y-m-d', 'd/m/Y', 'm/d/Y', 'd-m-Y', 'd.m.Y'] as $format) {
            try {
                $dt = Carbon::createFromFormat($format, $raw);
                if ($dt !== false && $dt->format($format) === $raw) {
                    return $dt->toDateString();
                }
            } catch (\Throwable) {
            }
        }
        try {
            return Carbon::parse($raw)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseTime(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $raw = trim((string) $value);
        try {
            return Carbon::parse($raw)->format('H:i:s');
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseHours(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        $raw = str_replace(',', '.', trim((string) $value));
        if (! is_numeric($raw)) {
            return null;
        }

        return round((float) $raw, 2);
    }

    private function hoursFromTimes(string $date, string $start, string $end): ?float
    {
        try {
            $from = Carbon::parse($date.' '.$start);
            $to = Carbon::parse($date.' '.$end);
            if ($end === '24:00:00') {
                $to = Carbon::parse($date)->addDay()->startOfDay();
            }
            if ($to->lte($from)) {
                $to->addDay();
            }

            return round($from->diffInSeconds($to) / 3600, 2);
        } catch (\Throwable) {
            return null;
        }
    }

    private function rowEmpty(array $values): bool
    {
        foreach ($values as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    private function refreshCounts(TimesheetImportBatch $batch): void
    {
        $batch->valid_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_VALID)->count();
        $batch->warning_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_WARNING)->count();
        $batch->error_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_ERROR)->count();
        $batch->duplicate_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_DUPLICATE)->count();
        $batch->excluded_rows = TimesheetImportRow::query()->where('import_batch_id', $batch->id)->where('row_status', TimesheetImportRow::STATUS_EXCLUDED)->count();
        $batch->save();
    }

    private function applyPreviewFilter($query, ?string $filter): void
    {
        match ($filter) {
            'valid' => $query->where('row_status', TimesheetImportRow::STATUS_VALID),
            'warning', 'warnings' => $query->where('row_status', TimesheetImportRow::STATUS_WARNING),
            'error', 'errors' => $query->where('row_status', TimesheetImportRow::STATUS_ERROR),
            'duplicate', 'duplicates' => $query->where('row_status', TimesheetImportRow::STATUS_DUPLICATE),
            'unmatched' => $query->whereNull('mapped_user_id'),
            'unmapped_project' => $query->whereJsonContains('messages', ['code' => 'unmapped_project']),
            'multi_day' => $query->where(function ($q) {
                $q->where('split_index', '>', 0)
                    ->orWhereJsonContains('messages', ['code' => 'multi_day']);
            }),
            default => null,
        };
    }

    private function nextReference(int $tenantId): string
    {
        $year = now()->year;
        $prefix = 'TS-IMP-'.$year.'-';
        $latest = TimesheetImportBatch::query()
            ->where('tenant_id', $tenantId)
            ->where('reference', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->value('reference');

        $seq = 1;
        if (is_string($latest) && preg_match('/-(\d+)$/', $latest, $matches) === 1) {
            $seq = ((int) $matches[1]) + 1;
        }

        return sprintf('TS-IMP-%d-%06d', $year, $seq);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function auditBatch(TimesheetImportBatch $batch, User $actor, string $eventType, array $payload = []): void
    {
        TimesheetAuditEvent::create([
            'tenant_id' => $batch->tenant_id,
            'timesheet_id' => null,
            'actor_id' => $actor->id,
            'event_type' => $eventType,
            'new_values' => array_merge(['batch_id' => $batch->id, 'reference' => $batch->reference], $payload),
        ]);
    }
}
