<?php

namespace App\Jobs;

use App\Models\TimesheetImportBatch;
use App\Models\User;
use App\Modules\Timesheets\Services\TimesheetImportCommitService;
use App\Modules\Timesheets\Services\TimesheetImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessTimesheetImportJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $uniqueFor = 3600;

    public function __construct(
        public readonly int $batchId,
        public readonly string $phase = 'ingest',
        public readonly ?int $actorId = null,
        public readonly bool $importValidOnly = true,
        public readonly ?string $idempotencyKey = null,
    ) {}

    public function uniqueId(): string
    {
        return 'timesheet-import-'.$this->batchId.'-'.$this->phase;
    }

    public function handle(TimesheetImportService $imports, TimesheetImportCommitService $commits): void
    {
        $batch = TimesheetImportBatch::query()->find($this->batchId);
        if (! $batch) {
            return;
        }
        try {
            if ($this->phase === 'ingest') {
                $imports->processStaging($batch);

                return;
            }
            $actor = User::query()->find($this->actorId ?: $batch->uploaded_by);
            if (! $actor) {
                return;
            }
            $commits->confirm($batch, $actor, $this->importValidOnly, $this->idempotencyKey);
        } catch (\Throwable $e) {
            Log::error('Timesheet import job failed', [
                'batch_id' => $this->batchId,
                'phase' => $this->phase,
                'message' => $e->getMessage(),
            ]);
            $batch->update([
                'status' => TimesheetImportBatch::STATUS_FAILED,
                'failure_reason' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
