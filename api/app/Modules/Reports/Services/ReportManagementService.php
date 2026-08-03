<?php

namespace App\Modules\Reports\Services;

use App\Models\User;
use App\Jobs\GenerateScheduledReportJob;
use Carbon\Carbon;
use App\Modules\PlatformAudit\Services\AuditEventIngestionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ReportManagementService
{
    public function schedules(int $tenantId, User $actor): array
    {
        $query = DB::table('report_schedules')->where('tenant_id', $tenantId)->orderByDesc('id');
        if (! $actor->can('reports.manage-schedules') && ! $actor->can('reports.export')) {
            $query->where('owner_id', $actor->id);
        }

        return $query->limit(100)->get()->map(fn ($row) => $this->decode($row))->all();
    }

    public function createSchedule(int $tenantId, array $data, User $actor): array
    {
        abort_unless($actor->can('reports.export'), 403, 'Report export permission is required to create a scheduled report.');

        $id = DB::table('report_schedules')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $this->reference('RPT'),
            'report_key' => $data['report_key'],
            'label' => $data['label'],
            'format' => $data['format'],
            'filters' => json_encode($data['filters'] ?? []),
            'recipients' => json_encode($data['recipients'] ?? []),
            'frequency' => $data['frequency'],
            'timezone' => $data['timezone'] ?? 'Africa/Windhoek',
            'next_run_at' => $data['next_run_at'] ?? now()->addDay(),
            'owner_id' => $actor->id,
            'status' => 'requested',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = $this->row($tenantId, $id);
        $this->audit($tenantId, $actor, 'report.schedule.created', 'schedule_created', 'ReportSchedule', $id, $row);

        return $row;
    }

    public function approveSchedule(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row($tenantId, $id);
        abort_if((int) $old['owner_id'] === $actor->id, 422, 'The schedule owner cannot approve their own scheduled report.');
        abort_unless($old['status'] === 'requested', 422, 'Only requested schedules can be approved.');

        DB::table('report_schedules')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'approved_by' => $actor->id,
            'status' => 'active',
            'updated_at' => now(),
        ]);
        $updated = $this->row($tenantId, $id);
        $this->audit($tenantId, $actor, 'report.schedule.approved', 'schedule_approved', 'ReportSchedule', $id, $updated);

        return $updated;
    }

    public function pauseSchedule(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row($tenantId, $id);
        abort_unless(in_array($old['status'], ['requested', 'active'], true), 422, 'Only active or requested schedules can be paused.');
        DB::table('report_schedules')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => 'paused',
            'updated_at' => now(),
        ]);
        $updated = $this->row($tenantId, $id);
        $this->audit($tenantId, $actor, 'report.schedule.paused', 'schedule_paused', 'ReportSchedule', $id, $updated);

        return $updated;
    }

    public function dispatchDueSchedules(?int $tenantId = null): int
    {
        if (! Schema::hasTable('report_schedules')) {
            return 0;
        }

        $query = DB::table('report_schedules')
            ->where('status', 'active')
            ->whereNotNull('next_run_at')
            ->where('next_run_at', '<=', now())
            ->orderBy('id');
        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $dispatched = 0;
        foreach ($query->pluck('id') as $scheduleId) {
            $eventId = DB::transaction(function () use ($scheduleId) {
                $schedule = DB::table('report_schedules')->where('id', $scheduleId)->lockForUpdate()->first();
                if (! $schedule || $schedule->status !== 'active' || ! $schedule->next_run_at || Carbon::parse($schedule->next_run_at)->isFuture()) {
                    return null;
                }

                $scheduledFor = Carbon::parse($schedule->next_run_at);
                $runKey = $schedule->id . ':' . $scheduledFor->utc()->format('Y-m-d\\TH:i:s\\Z');
                $existing = DB::table('report_export_events')->where('tenant_id', $schedule->tenant_id)->where('run_key', $runKey)->first();
                if ($existing) {
                    return null;
                }

                $eventId = DB::table('report_export_events')->insertGetId([
                    'tenant_id' => $schedule->tenant_id,
                    'schedule_id' => $schedule->id,
                    'reference' => $this->reference('EXP'),
                    'run_key' => $runKey,
                    'report_key' => $schedule->report_key,
                    'format' => $schedule->format,
                    'filters' => $schedule->filters,
                    'requested_by' => $schedule->owner_id,
                    'reason' => 'Scheduled report run',
                    'status' => 'queued',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('report_schedules')->where('id', $schedule->id)->update([
                    'last_run_at' => $scheduledFor,
                    'next_run_at' => $this->nextRun($scheduledFor, $schedule->frequency),
                    'updated_at' => now(),
                ]);

                return $eventId;
            });

            if ($eventId) {
                try {
                    GenerateScheduledReportJob::dispatch($eventId);
                } catch (\Throwable $exception) {
                    DB::table('report_export_events')->where('id', $eventId)->update([
                        'status' => 'failed',
                        'reason' => mb_substr($exception->getMessage(), 0, 255),
                        'updated_at' => now(),
                    ]);
                    throw $exception;
                }
                $dispatched++;
            }
        }

        return $dispatched;
    }

    public function recordExport(int $tenantId, string $reportKey, string $format, array $filters, User $actor, ?int $rows = null): ?int
    {
        if (! Schema::hasTable('report_export_events')) {
            return null;
        }

        $id = DB::table('report_export_events')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $this->reference('EXP'),
            'report_key' => $reportKey,
            'format' => $format,
            'filters' => json_encode($this->redactFilters($filters)),
            'rows_count' => $rows,
            'requested_by' => $actor->id,
            'reason' => $filters['reason'] ?? null,
            'status' => 'requested',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            app(AuditEventIngestionService::class)->ingest([
                'tenant_id' => $tenantId,
                'event_key' => 'system.export.generated',
                'category' => 'Report and Export',
                'action' => 'report_export_requested',
                'outcome' => 'Success',
                'severity' => 'Medium',
                'actor_id' => $actor->id,
                'actor_type' => 'human',
                'subject_type' => 'ReportExportEvent',
                'subject_id' => $id,
                'source_module' => 'reports',
                'payload' => ['report_key' => $reportKey, 'format' => $format, 'filters' => $this->redactFilters($filters)],
            ]);
        } catch (\Throwable) {
            // The export register is the local durable record; audit projection may retry.
        }

        return $id;
    }

    public function completeExport(int $tenantId, int $id, int $rows, string $payloadHash, ?string $filePath = null): void
    {
        DB::table('report_export_events')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->update([
                'rows_count' => $rows,
                'file_hash' => $payloadHash,
                'file_path' => $filePath,
                'status' => 'completed',
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function exportEvents(int $tenantId, User $actor): array
    {
        $query = DB::table('report_export_events')->where('tenant_id', $tenantId)->orderByDesc('id');
        if (! $actor->can('reports.audit') && ! $actor->can('reports.manage-schedules')) {
            $query->where('requested_by', $actor->id);
        }

        return $query->limit(100)->get()->map(fn ($row) => $this->decode($row))->all();
    }

    public function exportFile(int $tenantId, int $id): array
    {
        $row = DB::table('report_export_events')->where('tenant_id', $tenantId)->where('id', $id)->first();
        abort_unless($row, 404, 'Report export not found.');
        abort_unless($row->status === 'completed' && $row->file_path, 422, 'This scheduled report is not ready for download.');

        return (array) $row;
    }

    private function row(int $tenantId, int $id): array
    {
        $row = DB::table('report_schedules')->where('tenant_id', $tenantId)->where('id', $id)->first();
        abort_unless($row, 404, 'Scheduled report not found.');

        return $this->decode($row);
    }

    private function decode(object $row): array
    {
        $data = (array) $row;
        foreach (['filters', 'recipients'] as $field) {
            if (array_key_exists($field, $data) && is_string($data[$field])) {
                $data[$field] = json_decode($data[$field], true) ?: [];
            }
        }

        return $data;
    }

    private function reference(string $prefix): string
    {
        return $prefix . '-' . now()->format('Ymd') . '-' . strtoupper(Str::random(8));
    }

    private function nextRun(Carbon $from, string $frequency): Carbon
    {
        return match ($frequency) {
            'daily' => $from->copy()->addDay(),
            'weekly' => $from->copy()->addWeek(),
            default => $from->copy()->addMonthNoOverflow(),
        };
    }

    private function redactFilters(array $filters): array
    {
        foreach (['password', 'token', 'secret', 'bank_account'] as $field) {
            if (array_key_exists($field, $filters)) {
                $filters[$field] = '[REDACTED]';
            }
        }

        return $filters;
    }

    private function audit(int $tenantId, User $actor, string $eventType, string $action, string $subjectType, int $subjectId, array $payload): void
    {
        try {
            app(AuditEventIngestionService::class)->ingest([
                'tenant_id' => $tenantId,
                'event_key' => 'system.admin.action',
                'category' => 'Report and Export',
                'action' => $action,
                'outcome' => 'Success',
                'severity' => 'Medium',
                'actor_id' => $actor->id,
                'actor_type' => 'human',
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'source_module' => 'reports',
                'payload' => $payload,
            ]);
        } catch (\Throwable) {
            // Do not turn a schedule state change into a silent failure if projection is unavailable.
        }
    }
}
