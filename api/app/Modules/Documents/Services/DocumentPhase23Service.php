<?php

namespace App\Modules\Documents\Services;

use App\Models\Documents\DocumentDerivative;
use App\Models\Documents\DocumentDisposalRequest;
use App\Models\Documents\DocumentExternalShare;
use App\Models\Documents\DocumentOcrJob;
use App\Models\Documents\DocumentRetentionCampaign;
use App\Models\Documents\DocumentUploadSession;
use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Document Service Phase 2 (§123) solid slices + Phase 3 (§124) guarded AI stubs.
 */
class DocumentPhase23Service
{
    public function __construct(
        private readonly DocumentStorageService $documents,
    ) {}

    // ── Chunked upload sessions ──────────────────────────────────────────────

    public function initiateUpload(User $actor, array $data): DocumentUploadSession
    {
        return DocumentUploadSession::create([
            'tenant_id' => $actor->tenant_id,
            'created_by' => $actor->id,
            'session_uuid' => (string) Str::uuid(),
            'original_filename' => $data['original_filename'],
            'mime_type' => $data['mime_type'] ?? null,
            'declared_size' => $data['declared_size'] ?? null,
            'chunk_size' => (int) ($data['chunk_size'] ?? 1048576),
            'total_chunks' => $data['total_chunks'] ?? null,
            'received_chunks' => 0,
            'temp_path' => 'documents/uploads/'.$actor->tenant_id.'/'.Str::uuid(),
            'status' => 'initiated',
            'meta' => $data['meta'] ?? null,
            'expires_at' => now()->addHours(6),
        ]);
    }

    public function appendChunk(User $actor, DocumentUploadSession $session, UploadedFile $chunk, int $index): DocumentUploadSession
    {
        if ((int) $session->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
        if ($session->isExpired() || in_array($session->status, ['complete', 'aborted', 'failed'], true)) {
            throw ValidationException::withMessages(['session' => ['Upload session is not accepting chunks.']]);
        }

        $disk = $this->documents->storageDisk();
        $partPath = rtrim((string) $session->temp_path, '/').'/part_'.str_pad((string) $index, 6, '0', STR_PAD_LEFT);
        Storage::disk($disk)->put($partPath, file_get_contents($chunk->getRealPath()));

        $session->update([
            'status' => 'receiving',
            'received_chunks' => $session->received_chunks + 1,
        ]);

        return $session->fresh();
    }

    public function completeUpload(User $actor, DocumentUploadSession $session, array $meta = []): array
    {
        if ((int) $session->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
        if ($session->isExpired()) {
            throw ValidationException::withMessages(['session' => ['Upload session expired.']]);
        }

        $disk = $this->documents->storageDisk();
        $parts = Storage::disk($disk)->files((string) $session->temp_path);
        sort($parts);
        $assembled = '';
        foreach ($parts as $part) {
            $assembled .= Storage::disk($disk)->get($part);
        }

        $tmp = tempnam(sys_get_temp_dir(), 'docup');
        file_put_contents($tmp, $assembled);
        $uploaded = new UploadedFile(
            $tmp,
            $session->original_filename,
            $session->mime_type,
            null,
            true
        );

        $result = $this->documents->upload($actor, $uploaded, array_merge($session->meta ?? [], $meta, [
            'title' => $meta['title'] ?? $session->original_filename,
        ]));

        foreach ($parts as $part) {
            Storage::disk($disk)->delete($part);
        }
        Storage::disk($disk)->deleteDirectory((string) $session->temp_path);

        $session->update(['status' => 'complete']);
        @unlink($tmp);

        return $result;
    }

    // ── External time-limited shares ─────────────────────────────────────────

    public function createExternalShare(User $actor, DocumentVersion $version, array $data): array
    {
        if ($version->quarantine_status !== 'clean') {
            throw ValidationException::withMessages(['version' => ['Cannot share a quarantined version.']]);
        }

        $plain = Str::random(48);
        $row = DocumentExternalShare::create([
            'tenant_id' => $actor->tenant_id,
            'document_version_id' => $version->id,
            'token_hash' => hash('sha256', $plain),
            'recipient_email' => $data['recipient_email'] ?? null,
            'created_by' => $actor->id,
            'expires_at' => now()->addSeconds(max(60, (int) ($data['ttl_seconds'] ?? 3600))),
            'max_uses' => max(1, (int) ($data['max_uses'] ?? 1)),
            'use_count' => 0,
            'watermark' => (bool) ($data['watermark'] ?? true),
        ]);

        return [
            'token' => $plain,
            'expires_at' => $row->expires_at->toIso8601String(),
            'path' => '/api/v1/documents/public/share/'.$plain,
            'watermark' => $row->watermark,
        ];
    }

    public function streamExternalShare(string $plainToken): StreamedResponse
    {
        $row = DocumentExternalShare::query()->where('token_hash', hash('sha256', $plainToken))->first();
        if (! $row || ! $row->isValid()) {
            abort(403, 'Share link invalid or expired.');
        }
        $version = $row->version;
        if (! $version || $version->quarantine_status !== 'clean' || ! $version->existsOnDisk()) {
            abort(404);
        }

        $row->update(['use_count' => $row->use_count + 1]);

        $disk = $version->storage_disk ?: 'local';
        $filename = $version->original_filename;
        $mime = $version->mime_type ?: 'application/octet-stream';
        $raw = Storage::disk($disk)->get($version->storage_path) ?: '';
        if ($row->watermark) {
            $filename = 'WM-'.$filename;
            $raw = (new DocumentWatermarkPainter)->apply(
                $raw,
                $mime,
                'SADC-PF-NEXUS-WATERMARK // share '.$row->id
            );
        }

        return response()->streamDownload(
            function () use ($raw) {
                echo $raw;
            },
            $filename,
            ['Content-Type' => $mime]
        );
    }

    // ── OCR (async stub + optional HTTP driver) ──────────────────────────────

    public function queueOcr(User $actor, DocumentVersion $version): DocumentOcrJob
    {
        $driver = (string) config('documents.ocr_driver', 'null');
        $job = DocumentOcrJob::create([
            'tenant_id' => $actor->tenant_id,
            'document_version_id' => $version->id,
            'requested_by' => $actor->id,
            'driver' => $driver,
            'status' => 'queued',
        ]);

        // Null/default: complete immediately with empty text (no invented OCR).
        if ($driver === 'null' || $driver === 'disabled') {
            $job->update([
                'status' => 'complete',
                'extracted_text' => '',
                'completed_at' => now(),
                'error_message' => null,
            ]);
            DocumentDerivative::create([
                'tenant_id' => $actor->tenant_id,
                'source_version_id' => $version->id,
                'kind' => 'ocr_text',
                'status' => 'ready',
                'payload' => ['job_id' => $job->id, 'driver' => $driver],
            ]);
        }

        return $job->fresh();
    }

    // ── Redaction = new version (never mutate original) ──────────────────────

    public function createRedactionVersion(User $actor, DocumentVersion $source, UploadedFile $redactedFile, ?string $notes = null): array
    {
        if ($source->document?->isOnLegalHold()) {
            // Allowed: redaction creates a new version; hold still applies to disposal.
        }
        $result = $this->documents->upload($actor, $redactedFile, [
            'document_id' => $source->managed_document_id,
            'title' => $source->document?->title,
            'module' => $source->document?->module,
            'notes' => $notes ?? 'Redacted derivative version',
            'allow_hold_version' => true,
        ]);
        $result['version']->update([
            'is_derivative' => true,
            'derivative_of_version_id' => $source->id,
            'derivative_kind' => 'redaction',
        ]);
        DocumentDerivative::create([
            'tenant_id' => $actor->tenant_id,
            'source_version_id' => $source->id,
            'derivative_version_id' => $result['version']->id,
            'kind' => 'redaction',
            'status' => 'ready',
        ]);

        // Original remains authoritative and untouched.
        return $result;
    }

    // ── Watermarked download (derivative marker + active watermark headers) ──

    public function streamWatermarked(User $actor, DocumentVersion $version): StreamedResponse
    {
        $watermarkStamp = 'SADC-PF-NEXUS-WATERMARK // User: '.$actor->email.' // Date: '.now()->toIso8601String();

        DocumentDerivative::updateOrCreate(
            [
                'tenant_id' => $actor->tenant_id,
                'source_version_id' => $version->id,
                'kind' => 'watermark',
            ],
            [
                'status' => 'ready',
                'payload' => [
                    'note' => 'Active watermark download transform',
                    'stamp' => $watermarkStamp,
                    'actor_id' => $actor->id,
                ],
            ]
        );

        $disk = $version->storage_disk ?: 'local';
        $filename = 'WM-'.$version->original_filename;
        $mime = $version->mime_type ?: 'application/octet-stream';
        $raw = Storage::disk($disk)->get($version->storage_path) ?: '';
        $painted = (new DocumentWatermarkPainter)->apply($raw, $mime, $watermarkStamp);

        return response()->streamDownload(
            function () use ($painted) {
                echo $painted;
            },
            $filename,
            [
                'Content-Type' => $mime,
                'X-Nexus-Watermark-Applied' => 'true',
                'X-Nexus-Watermark-Stamp' => $watermarkStamp,
                'X-Nexus-Watermark-Visual' => 'true',
            ]
        );
    }

    // ── Duplicate suggestions by content hash ────────────────────────────────

    public function duplicateSuggestions(User $actor, string $hash): array
    {
        $versions = DocumentVersion::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('content_hash', strtolower($hash))
            ->with('document:id,title,module,classification')
            ->limit(50)
            ->get();

        return [
            'content_hash' => strtolower($hash),
            'count' => $versions->count(),
            'documents' => $versions->map(fn ($v) => [
                'document_id' => $v->managed_document_id,
                'version_id' => $v->id,
                'title' => $v->document?->title,
                'module' => $v->document?->module,
                'version_number' => $v->version_number,
            ])->values(),
        ];
    }

    // ── Retention campaigns ──────────────────────────────────────────────────

    public function createRetentionCampaign(User $actor, array $data): DocumentRetentionCampaign
    {
        $cutoff = $data['cutoff_date'] ?? now()->toDateString();
        $candidates = ManagedDocument::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNull('purged_at')
            ->where(function ($q) use ($cutoff) {
                $q->whereNotNull('retain_until')->where('retain_until', '<=', $cutoff);
            })
            ->get();

        return DocumentRetentionCampaign::create([
            'tenant_id' => $actor->tenant_id,
            'name' => $data['name'],
            'status' => 'active',
            'cutoff_date' => $cutoff,
            'candidate_count' => $candidates->count(),
            'held_count' => $candidates->where('legal_hold', true)->count(),
            'disposed_count' => 0,
            'created_by' => $actor->id,
            'filters' => $data['filters'] ?? null,
        ]);
    }

    public function retentionDashboard(User $actor): array
    {
        $tenantId = $actor->tenant_id;
        $base = ManagedDocument::query()->where('tenant_id', $tenantId)->whereNull('purged_at');

        return [
            'total' => (clone $base)->count(),
            'on_legal_hold' => (clone $base)->where('legal_hold', true)->count(),
            'past_retain_until' => (clone $base)->whereNotNull('retain_until')->where('retain_until', '<', now()->toDateString())->count(),
            'archived' => (clone $base)->where('archive_status', 'archived')->count(),
            'pending_disposal' => DocumentDisposalRequest::query()->where('tenant_id', $tenantId)->where('status', 'pending')->count(),
            'campaigns' => DocumentRetentionCampaign::query()->where('tenant_id', $tenantId)->latest('id')->limit(20)->get(),
        ];
    }

    // ── Disposal workflow (holds override) ───────────────────────────────────

    public function requestDisposal(User $actor, ManagedDocument $document, string $reason): DocumentDisposalRequest
    {
        if ($document->isOnLegalHold()) {
            return DocumentDisposalRequest::create([
                'tenant_id' => $actor->tenant_id,
                'managed_document_id' => $document->id,
                'requested_by' => $actor->id,
                'status' => 'blocked_hold',
                'reason' => $reason,
                'decision_notes' => 'Blocked: legal hold overrides disposal.',
            ]);
        }

        return DocumentDisposalRequest::create([
            'tenant_id' => $actor->tenant_id,
            'managed_document_id' => $document->id,
            'requested_by' => $actor->id,
            'status' => 'pending',
            'reason' => $reason,
        ]);
    }

    // ── Archive class / physical barcode ─────────────────────────────────────

    public function updatePhysicalAndArchive(User $actor, ManagedDocument $document, array $data): ManagedDocument
    {
        $document->update(array_filter([
            'archive_class' => $data['archive_class'] ?? null,
            'archive_status' => $data['archive_status'] ?? null,
            'physical_barcode' => $data['physical_barcode'] ?? null,
            'physical_location' => $data['physical_location'] ?? null,
            'has_physical_original' => array_key_exists('has_physical_original', $data)
                ? (bool) $data['has_physical_original']
                : null,
        ], fn ($v) => $v !== null));

        AuditLog::record('document.archive_physical_updated', [
            'auditable_type' => ManagedDocument::class,
            'auditable_id' => $document->id,
            'new_values' => $data,
            'tags' => ['document-service'],
        ]);

        return $document->fresh();
    }

    // ── SharePoint / OneDrive migration stub ─────────────────────────────────

    public function migrationUtilityStatus(): array
    {
        $url = trim((string) config('documents.sharepoint_http_url', ''));
        $ready = $url !== '';

        return [
            'utility' => 'sharepoint_onedrive_migration',
            'status' => $ready ? 'ready' : 'stub',
            'message' => $ready
                ? 'HTTP SharePoint/OneDrive connector configured. Import never auto-publishes.'
                : 'Migration utility scaffold only — no live connector until governance approves credentials.',
            'drivers' => $ready ? ['http'] : ['null'],
        ];
    }

    // ── Bulk scan (re-scan quarantined / pending) ────────────────────────────

    public function bulkRescan(User $actor, array $versionIds): array
    {
        $results = [];
        foreach ($versionIds as $id) {
            $version = DocumentVersion::query()
                ->where('tenant_id', $actor->tenant_id)
                ->find($id);
            if (! $version) {
                $results[] = ['id' => $id, 'status' => 'missing'];
                continue;
            }
            $scanner = app(\App\Modules\Documents\Contracts\MalwareScannerInterface::class);
            $scan = $scanner->scan($version->storage_path, $version->storage_disk ?: 'local', $version->storage_path);
            $status = $this->documents->normalizeScanStatus($scan);
            if ($status === 'infected') {
                $version->update([
                    'quarantine_status' => 'infected',
                    'quarantine_reason' => $scan['summary'] ?? 'Infected on rescan',
                    'scanned_at' => now(),
                    'scan_provider' => $scan['provider'] ?? null,
                ]);
            } else {
                $version->update([
                    'quarantine_status' => $status,
                    'quarantine_reason' => $status === 'clean' ? null : ($scan['summary'] ?? 'Scan incomplete'),
                    'scanned_at' => now(),
                    'scan_provider' => $scan['provider'] ?? null,
                ]);
            }
            $results[] = ['id' => $version->id, 'status' => $status];
        }

        return ['results' => $results];
    }

    // ── Phase 3 AI stubs (guarded — never mutate authoritative state) ────────

    public function aiSuggest(User $actor, ManagedDocument $document, string $action): array
    {
        $allowed = ['metadata', 'summarise', 'redact_suggestions', 'suggest_type'];
        if (! in_array($action, $allowed, true)) {
            throw ValidationException::withMessages(['action' => ['Unknown AI action.']]);
        }

        return [
            'action' => $action,
            'document_id' => $document->id,
            'status' => 'suggestion_only',
            'requires_human_confirm' => true,
            'guards' => [
                'never_change_authoritative_version' => true,
                'never_release_quarantine' => true,
                'never_downgrade_confidentiality' => true,
                'never_approve_disposal' => true,
                'never_remove_hold' => true,
                'never_determine_retention_conclusively' => true,
                'never_sign' => true,
                'never_alter_original_evidence' => true,
            ],
            'suggestion' => [
                'note' => 'AI stub — no model invoked. Human must confirm any apply path.',
                'proposed' => new \stdClass,
            ],
        ];
    }
}
