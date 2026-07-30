<?php

namespace App\Modules\Documents\Services;

use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\Documents\DocumentAuditEvent;
use App\Models\Documents\DocumentDownloadToken;
use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Models\PeopleAuthority\PersonDocument;
use App\Models\User;
use App\Modules\Documents\Contracts\MalwareScannerInterface;
use App\Support\UploadContentSniffer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Shared Document Service — versioned, hashed, ACL-gated storage for Workflow,
 * People signatures, Correspondence, and Notifications secure links.
 */
class DocumentStorageService
{
    public function __construct(
        private readonly MalwareScannerInterface $scanner,
    ) {}

    public function storageDisk(): string
    {
        $disk = (string) config('filesystems.default', 'local');
        // Never store managed documents on the public disk.
        if ($disk === 'public') {
            return 'local';
        }

        return $disk !== '' ? $disk : 'local';
    }

    /**
     * @param  array{
     *   title?: string,
     *   module?: string,
     *   subject_type?: ?string,
     *   subject_id?: ?int,
     *   classification?: string,
     *   notes?: ?string,
     *   document_id?: ?int,
     * }  $meta
     * @return array{document: ManagedDocument, version: DocumentVersion}
     */
    public function upload(User $actor, UploadedFile $file, array $meta = []): array
    {
        $mime = UploadContentSniffer::assertAllowed($file);
        $bytes = file_get_contents($file->getRealPath());
        if ($bytes === false) {
            throw ValidationException::withMessages(['file' => ['Unable to read uploaded file.']]);
        }
        $hash = hash('sha256', $bytes);

        return DB::transaction(function () use ($actor, $file, $meta, $mime, $hash) {
            $document = null;
            if (! empty($meta['document_id'])) {
                $document = ManagedDocument::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->findOrFail((int) $meta['document_id']);

                if ($document->is_final) {
                    throw ValidationException::withMessages([
                        'document' => ['Final documents are immutable; create a new document to change content.'],
                    ]);
                }
                // Prior signed/final versions stay immutable; this path always appends a new version.
            }

            if (! $document) {
                $document = ManagedDocument::create([
                    'tenant_id' => $actor->tenant_id,
                    'owner_user_id' => $actor->id,
                    'title' => $meta['title'] ?? $file->getClientOriginalName(),
                    'module' => $meta['module'] ?? 'general',
                    'subject_type' => $meta['subject_type'] ?? null,
                    'subject_id' => $meta['subject_id'] ?? null,
                    'classification' => $meta['classification'] ?? 'UNCLASSIFIED',
                    'is_final' => false,
                ]);
            }

            $nextVersion = (int) $document->versions()->max('version_number') + 1;
            $disk = $this->storageDisk();
            $dir = sprintf(
                'documents/%s/%s',
                $actor->tenant_id,
                $document->id
            );
            $path = $file->store($dir, ['disk' => $disk]);

            $scanPath = $path;
            try {
                $scanPath = Storage::disk($disk)->path($path);
            } catch (\Throwable) {
                // S3-compatible disks have no local path; Null scanner does not need one.
            }
            $scan = $this->scanner->scan($scanPath, $disk, $path);

            if (($scan['status'] ?? '') === 'infected') {
                Storage::disk($disk)->delete($path);
                throw ValidationException::withMessages([
                    'file' => ['Upload rejected by malware scan.'],
                ]);
            }

            $version = DocumentVersion::create([
                'tenant_id' => $actor->tenant_id,
                'managed_document_id' => $document->id,
                'version_number' => $nextVersion,
                'content_hash' => $hash,
                'storage_disk' => $disk,
                'storage_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $mime,
                'size_bytes' => $file->getSize(),
                'quarantine_status' => $scan['status'] ?? 'clean',
                'scanned_at' => now(),
                'scan_provider' => $scan['provider'] ?? $this->scanner->providerName(),
                'status' => DocumentVersion::STATUS_ACTIVE,
                'is_immutable' => false,
                'uploaded_by' => $actor->id,
                'notes' => $meta['notes'] ?? null,
            ]);

            $document->update(['current_version_id' => $version->id]);

            $this->audit($actor, 'document.uploaded', $document, $version, [
                'version_number' => $version->version_number,
                'content_hash' => $hash,
                'quarantine_status' => $version->quarantine_status,
            ]);

            AuditLog::record('document.uploaded', [
                'auditable_type' => ManagedDocument::class,
                'auditable_id' => $document->id,
                'new_values' => [
                    'version_id' => $version->id,
                    'content_hash' => $hash,
                ],
                'tags' => ['document-service'],
            ]);

            return [
                'document' => $document->fresh(['currentVersion', 'versions']),
                'version' => $version,
            ];
        });
    }

    /**
     * Create a new version after a signed/final lock by attaching to a document
     * that is NOT final — callers must not mutate locked version bytes.
     *
     * @return array{document: ManagedDocument, version: DocumentVersion}
     */
    public function uploadNewVersion(User $actor, ManagedDocument $document, UploadedFile $file, array $meta = []): array
    {
        if ((int) $document->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        if ($document->is_final) {
            throw ValidationException::withMessages([
                'document' => ['Document is marked final. Create a new document for changes.'],
            ]);
        }

        $mime = UploadContentSniffer::assertAllowed($file);
        $bytes = file_get_contents($file->getRealPath());
        if ($bytes === false) {
            throw ValidationException::withMessages(['file' => ['Unable to read uploaded file.']]);
        }
        $hash = hash('sha256', $bytes);

        return DB::transaction(function () use ($actor, $document, $file, $meta, $mime, $hash) {
            $nextVersion = (int) $document->versions()->max('version_number') + 1;
            $disk = $this->storageDisk();
            $dir = sprintf('documents/%s/%s', $actor->tenant_id, $document->id);
            $path = $file->store($dir, ['disk' => $disk]);

            $scanPath = $path;
            try {
                $scanPath = Storage::disk($disk)->path($path);
            } catch (\Throwable) {
                // S3-compatible disks have no local path; Null scanner does not need one.
            }
            $scan = $this->scanner->scan($scanPath, $disk, $path);

            if (($scan['status'] ?? '') === 'infected') {
                Storage::disk($disk)->delete($path);
                throw ValidationException::withMessages(['file' => ['Upload rejected by malware scan.']]);
            }

            $version = DocumentVersion::create([
                'tenant_id' => $actor->tenant_id,
                'managed_document_id' => $document->id,
                'version_number' => $nextVersion,
                'content_hash' => $hash,
                'storage_disk' => $disk,
                'storage_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $mime,
                'size_bytes' => $file->getSize(),
                'quarantine_status' => $scan['status'] ?? 'clean',
                'scanned_at' => now(),
                'scan_provider' => $scan['provider'] ?? $this->scanner->providerName(),
                'status' => DocumentVersion::STATUS_ACTIVE,
                'is_immutable' => false,
                'uploaded_by' => $actor->id,
                'notes' => $meta['notes'] ?? null,
            ]);

            $document->update(['current_version_id' => $version->id, 'is_final' => false]);

            $this->audit($actor, 'document.version_created', $document, $version, [
                'version_number' => $version->version_number,
                'content_hash' => $hash,
            ]);

            return [
                'document' => $document->fresh(['currentVersion', 'versions']),
                'version' => $version,
            ];
        });
    }

    public function markFinal(User $actor, DocumentVersion $version): DocumentVersion
    {
        $this->assertTenant($actor, $version->tenant_id);

        if ($version->isLocked() && $version->status === DocumentVersion::STATUS_FINAL) {
            return $version;
        }

        $version->update([
            'status' => DocumentVersion::STATUS_FINAL,
            'is_immutable' => true,
            'finalized_at' => now(),
            'finalized_by' => $actor->id,
        ]);

        $version->document?->update(['is_final' => true]);

        $this->audit($actor, 'document.finalized', $version->document, $version, [
            'content_hash' => $version->content_hash,
        ]);

        AuditLog::record('document.finalized', [
            'auditable_type' => DocumentVersion::class,
            'auditable_id' => $version->id,
            'new_values' => ['content_hash' => $version->content_hash],
            'tags' => ['document-service'],
        ]);

        return $version->fresh();
    }

    /**
     * Lock a version after People / Workflow signature binding.
     */
    public function lockAfterSignature(User $actor, DocumentVersion $version, array $payload = []): DocumentVersion
    {
        $this->assertTenant($actor, $version->tenant_id);

        $version->update([
            'status' => DocumentVersion::STATUS_IMMUTABLE,
            'is_immutable' => true,
            'signed_locked_at' => now(),
        ]);

        $this->audit($actor, 'document.signed_locked', $version->document, $version, array_merge([
            'content_hash' => $version->content_hash,
        ], $payload));

        return $version->fresh();
    }

    /**
     * Refuse mutation of storage bytes for locked versions.
     */
    public function assertMutable(DocumentVersion $version): void
    {
        if ($version->isLocked()) {
            throw ValidationException::withMessages([
                'version' => ['This document version is immutable after sign/final. Upload a new version.'],
            ]);
        }
    }

    public function metadata(User $actor, ManagedDocument $document): ManagedDocument
    {
        $this->assertTenant($actor, $document->tenant_id);

        return $document->load(['currentVersion.uploader:id,name', 'versions.uploader:id,name', 'owner:id,name']);
    }

    public function listVersions(User $actor, ManagedDocument $document)
    {
        $this->assertTenant($actor, $document->tenant_id);

        return $document->versions()->with('uploader:id,name')->get();
    }

    public function authorizeDownload(User $actor, DocumentVersion $version): bool
    {
        if ((int) $version->tenant_id !== (int) $actor->tenant_id) {
            return false;
        }

        if ($actor->can('documents.admin') || $actor->can('documents.download') || $actor->isSystemAdmin()) {
            return true;
        }

        $doc = $version->document;
        if ($doc && (int) $doc->owner_user_id === (int) $actor->id) {
            return true;
        }

        if ($actor->can('documents.view') || $actor->can('documents.sign') || $actor->can('workflows.sign')) {
            return true;
        }

        return false;
    }

    public function streamDownload(User $actor, DocumentVersion $version): StreamedResponse
    {
        if (! $this->authorizeDownload($actor, $version)) {
            $this->audit($actor, 'document.access_denied', $version->document, $version, [
                'reason' => 'unauthorized_download',
            ]);
            abort(403, 'Unauthorized document download.');
        }

        if (! $version->existsOnDisk()) {
            abort(404, 'File not found.');
        }

        $this->audit($actor, 'document.downloaded', $version->document, $version, [
            'content_hash' => $version->content_hash,
        ]);

        AuditLog::record('document.downloaded', [
            'auditable_type' => DocumentVersion::class,
            'auditable_id' => $version->id,
            'new_values' => ['content_hash' => $version->content_hash],
            'tags' => ['document-service'],
        ]);

        $disk = $version->storage_disk ?: 'local';

        return response()->streamDownload(
            function () use ($version, $disk) {
                $stream = Storage::disk($disk)->readStream($version->storage_path);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            },
            $version->original_filename,
            ['Content-Type' => $version->mime_type ?: 'application/octet-stream']
        );
    }

    /**
     * Issue a short-lived opaque download token (no public permanent URL).
     *
     * @return array{token: string, expires_at: string, download_path: string}
     */
    public function issueDownloadToken(User $actor, DocumentVersion $version, int $ttlSeconds = 300, int $maxUses = 1): array
    {
        if (! $this->authorizeDownload($actor, $version)) {
            abort(403, 'Unauthorized.');
        }

        $plain = Str::random(48);
        $row = DocumentDownloadToken::create([
            'tenant_id' => $actor->tenant_id,
            'document_version_id' => $version->id,
            'token_hash' => hash('sha256', $plain),
            'created_by' => $actor->id,
            'expires_at' => now()->addSeconds(max(30, $ttlSeconds)),
            'max_uses' => max(1, $maxUses),
            'use_count' => 0,
        ]);

        $this->audit($actor, 'document.token_issued', $version->document, $version, [
            'token_id' => $row->id,
            'expires_at' => $row->expires_at?->toIso8601String(),
        ]);

        return [
            'token' => $plain,
            'expires_at' => $row->expires_at->toIso8601String(),
            'download_path' => '/api/v1/documents/download-token/'.$plain,
        ];
    }

    public function streamViaToken(string $plainToken, ?User $actor = null): StreamedResponse
    {
        $hash = hash('sha256', $plainToken);
        $row = DocumentDownloadToken::query()->where('token_hash', $hash)->first();
        if (! $row || ! $row->isValid()) {
            abort(403, 'Download token invalid or expired.');
        }

        $version = $row->version;
        if (! $version || ! $version->existsOnDisk()) {
            abort(404, 'File not found.');
        }

        if ($actor && (int) $actor->tenant_id !== (int) $row->tenant_id) {
            abort(403, 'Tenant mismatch.');
        }

        $row->update([
            'use_count' => $row->use_count + 1,
            'used_at' => now(),
        ]);

        $this->audit($actor, 'document.downloaded', $version->document, $version, [
            'via' => 'download_token',
            'token_id' => $row->id,
        ]);

        $disk = $version->storage_disk ?: 'local';

        return response()->streamDownload(
            function () use ($version, $disk) {
                $stream = Storage::disk($disk)->readStream($version->storage_path);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            },
            $version->original_filename,
            ['Content-Type' => $version->mime_type ?: 'application/octet-stream']
        );
    }

    /**
     * Bridge: sync Attachment content_hash for Workflow approval packages.
     */
    public function syncAttachmentHash(Attachment $attachment): ?string
    {
        if ($attachment->content_hash) {
            return $attachment->content_hash;
        }
        if (! $attachment->storage_path) {
            return null;
        }
        $disk = $attachment->getStorageDisk();
        if (! Storage::disk($disk)->exists($attachment->storage_path)) {
            return null;
        }
        $hash = hash('sha256', Storage::disk($disk)->get($attachment->storage_path));
        $attachment->forceFill(['content_hash' => $hash])->save();

        return $hash;
    }

    /**
     * Link a PersonDocument row to a managed version (People confidential registry).
     */
    public function linkPersonDocument(PersonDocument $personDoc, DocumentVersion $version): PersonDocument
    {
        $personDoc->forceFill([
            'storage_path' => $version->storage_path,
            'content_hash' => $version->content_hash,
            'managed_document_id' => $version->managed_document_id,
            'document_version_id' => $version->id,
            'is_immutable' => $version->is_immutable,
        ])->save();

        return $personDoc->fresh();
    }

    public function findVersionForTenant(int $tenantId, int|string $versionId): DocumentVersion
    {
        return DocumentVersion::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($versionId);
    }

    private function audit(?User $actor, string $eventType, ?ManagedDocument $document, ?DocumentVersion $version, array $payload = []): void
    {
        DocumentAuditEvent::create([
            'tenant_id' => $actor?->tenant_id ?? $document?->tenant_id ?? $version?->tenant_id,
            'managed_document_id' => $document?->id ?? $version?->managed_document_id,
            'document_version_id' => $version?->id,
            'event_type' => $eventType,
            'actor_user_id' => $actor?->id,
            'payload' => $payload,
            'ip_address' => request()?->ip(),
            'user_agent' => request()?->userAgent(),
            'occurred_at' => now(),
        ]);
    }

    private function assertTenant(User $actor, int $tenantId): void
    {
        if ((int) $actor->tenant_id !== (int) $tenantId) {
            abort(404);
        }
    }
}
