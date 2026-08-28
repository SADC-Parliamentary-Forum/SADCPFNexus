<?php

namespace App\Console\Commands;

use App\Models\Documents\DocumentDerivative;
use App\Models\Documents\DocumentOcrJob;
use App\Modules\Documents\Drivers\HttpOcrDriver;
use Illuminate\Console\Command;

class ProcessDocumentOcrJobs extends Command
{
    protected $signature = 'documents:process-ocr-jobs {--limit=20}';

    protected $description = 'Process queued HTTP OCR jobs (no-op when DOCUMENT_OCR_DRIVER is null)';

    public function handle(HttpOcrDriver $ocr): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $jobs = DocumentOcrJob::query()
            ->with('version')
            ->where('status', 'queued')
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $done = 0;
        foreach ($jobs as $job) {
            $version = $job->version;
            if (! $version) {
                $job->update(['status' => 'failed', 'error_message' => 'Missing document version', 'completed_at' => now()]);
                continue;
            }
            $result = $ocr->extract(
                $version->storage_disk ?: 'local',
                (string) $version->storage_path,
                (string) ($version->original_filename ?: 'document.bin')
            );
            $job->update([
                'status' => $result['ok'] ? 'complete' : 'failed',
                'extracted_text' => $result['text'] ?: '',
                'error_message' => $result['error'],
                'completed_at' => now(),
            ]);
            if ($result['ok']) {
                DocumentDerivative::create([
                    'tenant_id' => $job->tenant_id,
                    'source_version_id' => $version->id,
                    'kind' => 'ocr_text',
                    'status' => 'ready',
                    'payload' => ['job_id' => $job->id, 'driver' => 'http'],
                ]);
            }
            $done++;
        }

        $this->info("Processed {$done} OCR job(s).");

        return self::SUCCESS;
    }
}
