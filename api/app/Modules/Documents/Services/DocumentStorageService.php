<?php

namespace App\Modules\Documents\Services;

use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\Documents\DocumentAuditEvent;
use App\Models\Documents\DocumentDownloadToken;
use App\Models\Documents\DocumentFileObject;
use App\Models\Documents\DocumentLink;
use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Models\PeopleAuthority\PersonDocument;
use App\Models\User;
use App\Modules\Documents\Contracts\MalwareScannerInterface;
use App\Support\UploadContentSniffer;
use Illuminate\Database\Eloquent\Model;
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
     *   document_type?: ?string,
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

        return DB::transaction(function () use ($actor, $file, $meta, $mime, $hash, $bytes) {
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
                if ($document->isOnLegalHold() && ($meta['allow_hold_version'] ?? false) !== true) {
                    // Holds block disposal/purge; appending evidence versions is allowed for admins only via flag.
                }
            }

            if (! $document) {
                $document = ManagedDocument::create([
                    'tenant_id' => $actor->tenant_id,
                    'owner_user_id' => $actor->id,
                    'title' => $meta['title'] ?? $file->getClientOriginalName(),
                    'module' => $meta['module'] ?? 'general',
                    'document_type' => $meta['document_type'] ?? null,
                    'subject_type' => $meta['subject_type'] ?? null,
                    'subject_id' => $meta['subject_id'] ?? null,
                    'classification' => $meta['classification'] ?? 'UNCLASSIFIED',
                    'is_final' => false,
                    'archive_class' => 'hot',
                    'archive_status' => 'active',
                    'search_text' => trim(($meta['title'] ?? $file->getClientOriginalName()).' '.($meta['module'] ?? '')),
                ]);
            }

            $nextVersion = (int) $document->versions()->max('version_number') + 1;
            $disk = $this->storageDisk();
            $dir = sprintf('documents/%s/%s', $actor->tenant_id, $document->id);
            $path = $file->store($dir, ['disk' => $disk]);

            $scanPath = $path;
            try {
                $scanPath = Storage::disk($disk)->path($path);
            } catch (\Throwable) {
            }
            $scan = $this->scanner->scan($scanPath, $disk, $path);
            $quarantine = $this->normalizeScanStatus($scan);

            if ($quarantine === 'infected') {
                Storage::disk($disk)->delete($path);
                throw ValidationException::withMessages([
                    'file' => ['Upload rejected by malware scan.'],
                ]);
            }

            // PRD §126: failed scan ≠ clean — keep pending/error in quarantine (not releasable).
            $fileObject = DocumentFileObject::query()->firstOrCreate(
                [
                    'tenant_id' => $actor->tenant_id,
                    'content_hash' => $hash,
                ],
                [
                    'storage_disk' => $disk,
                    'storage_path' => $path,
                    'mime_type' => $mime,
                    'size_bytes' => $file->getSize(),
                    'quarantine_status' => $quarantine,
                    'scanned_at' => now(),
                    'scan_provider' => $scan['provider'] ?? $this->scanner->providerName(),
                    'scan_summary' => $scan['summary'] ?? null,
                    'ref_count' => 0,
                ]
            );

            // If reusing an existing hash object, bump ref; never overwrite binary path.
            if (! $fileObject->wasRecentlyCreated && $fileObject->storage_path !== $path) {
                // Deduplicate: drop the newly stored copy; point version at existing object.
                Storage::disk($disk)->delete($path);
                $path = $fileObject->storage_path;
                $disk = $fileObject->storage_disk ?: $disk;
            }

            $fileObject->increment('ref_count');
            if ($fileObject->quarantine_status !== 'clean' && $quarantine === 'clean') {
                $fileObject->update([
                    'quarantine_status' => 'clean',
                    'scanned_at' => now(),
                    'scan_provider' => $scan['provider'] ?? $this->scanner->providerName(),
                    'scan_summary' => $scan['summary'] ?? null,
                ]);
            }

            $version = DocumentVersion::create([
                'tenant_id' => $actor->tenant_id,
                'managed_document_id' => $document->id,
                'file_object_id' => $fileObject->id,
                'version_number' => $nextVersion,
                'content_hash' => $hash,
                'storage_disk' => $disk,
                'storage_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $mime,
                'size_bytes' => $file->getSize(),
                'quarantine_status' => $quarantine,
                'scanned_at' => now(),
                'scan_provider' => $scan['provider'] ?? $this->scanner->providerName(),
                'quarantine_reason' => $quarantine === 'clean' ? null : ($scan['summary'] ?? 'Awaiting clean scan'),
                'status' => DocumentVersion::STATUS_ACTIVE,
                'is_immutable' => false,
                'uploaded_by' => $actor->id,
                'notes' => $meta['notes'] ?? null,
            ]);

            $document->update([
                'current_version_id' => $version->id,
                'search_text' => trim(($document->title ?? '').' '.($document->module ?? '').' '.$file->getClientOriginalName().' '.$hash),
            ]);

            $this->audit($actor, 'document.uploaded', $document, $version, [
                'version_number' => $version->version_number,
                'content_hash' => $hash,
                'quarantine_status' => $version->quarantine_status,
                'file_object_id' => $fileObject->id,
            ]);

            AuditLog::record('document.uploaded', [
                'auditable_type' => ManagedDocument::class,
                'auditable_id' => $document->id,
                'new_values' => [
                    'version_id' => $version->id,
                    'content_hash' => $hash,
                    'quarantine_status' => $quarantine,
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
     * Normalize AV result. Only explicit 'clean' is releasable. error/pending stay quarantined.
     */
    public function normalizeScanStatus(array $scan): string
    {
        $status = strtolower((string) ($scan['status'] ?? 'error'));
        if ($status === 'clean') {
            return 'clean';
        }
        if ($status === 'infected') {
            return 'infected';
        }
        if ($status === 'pending') {
            return 'pending';
        }

        return 'error';
    }

    public function createLink(
        User $actor,
        ManagedDocument $document,
        ?DocumentVersion $version,
        Model $linkable,
        ?string $role = 'attachment',
        ?string $label = null
    ): DocumentLink {
        $this->assertTenant($actor, $document->tenant_id);

        $link = DocumentLink::create([
            'tenant_id' => $actor->tenant_id,
            'managed_document_id' => $document->id,
            'document_version_id' => $version?->id ?? $document->current_version_id,
            'linkable_type' => $linkable::class,
            'linkable_id' => (int) $linkable->getKey(),
            'role' => $role,
            'label' => $label,
            'linked_by' => $actor->id,
        ]);

        $this->audit($actor, 'document.linked', $document, $version, [
            'link_id' => $link->id,
            'linkable_type' => $link->linkable_type,
            'linkable_id' => $link->linkable_id,
            'role' => $role,
        ]);

        return $link;
    }

    public function unlink(User $actor, DocumentLink $link): DocumentLink
    {
        $this->assertTenant($actor, $link->tenant_id);
        if ($link->unlinked_at) {
            return $link;
        }

        $link->update([
            'unlinked_at' => now(),
            'unlinked_by' => $actor->id,
        ]);

        $this->audit($actor, 'document.unlinked', $link->document, $link->version, [
            'link_id' => $link->id,
        ]);

        return $link->fresh();
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

        if ($version->quarantine_status !== 'clean') {
            $this->audit($actor, 'document.quarantine_blocked', $version->document, $version, [
                'quarantine_status' => $version->quarantine_status,
            ]);
            abort(423, 'Document is quarantined and not released for download.');
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

    /**
     * Admin register: paginated managed documents for the actor's tenant.
     *
     * @param  array{module?: string, q?: string, legal_hold?: bool|string, classification?: string, per_page?: int}  $filters
     */
    public function listRegister(User $actor, array $filters = [])
    {
        $query = ManagedDocument::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNull('purged_at')
            ->with(['currentVersion', 'owner:id,name', 'legalHoldSetter:id,name'])
            ->latest('id');

        if (! empty($filters['module'])) {
            $query->where('module', $filters['module']);
        }
        if (! empty($filters['classification'])) {
            $query->where('classification', $filters['classification']);
        }
        if (array_key_exists('legal_hold', $filters) && $filters['legal_hold'] !== null && $filters['legal_hold'] !== '') {
            $hold = filter_var($filters['legal_hold'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($hold !== null) {
                $query->where('legal_hold', $hold);
            }
        }
        if (! empty($filters['q'])) {
            $q = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $filters['q']).'%';
            $query->where(function ($inner) use ($q) {
                $inner->where('title', 'ilike', $q)
                    ->orWhere('module', 'ilike', $q)
                    ->orWhereHas('versions', fn ($v) => $v->where('content_hash', 'ilike', $q)
                        ->orWhere('original_filename', 'ilike', $q));
            });
        }

        $perPage = min(max((int) ($filters['per_page'] ?? 25), 1), 100);

        return $query->paginate($perPage);
    }

    public function placeLegalHold(User $actor, ManagedDocument $document, string $reason): ManagedDocument
    {
        $this->assertTenant($actor, $document->tenant_id);
        if (trim($reason) === '') {
            throw ValidationException::withMessages([
                'legal_hold_reason' => ['A reason is required when placing a legal hold.'],
            ]);
        }

        $document->update([
            'legal_hold' => true,
            'legal_hold_reason' => $reason,
            'legal_hold_set_by' => $actor->id,
            'legal_hold_set_at' => now(),
        ]);

        $this->audit($actor, 'document.legal_hold_placed', $document, $document->currentVersion, [
            'reason' => $reason,
        ]);

        AuditLog::record('document.legal_hold_placed', [
            'auditable_type' => ManagedDocument::class,
            'auditable_id' => $document->id,
            'new_values' => ['legal_hold' => true, 'reason' => $reason],
            'tags' => ['document-service', 'legal-hold'],
        ]);

        return $document->fresh(['currentVersion', 'legalHoldSetter:id,name']);
    }

    public function releaseLegalHold(User $actor, ManagedDocument $document): ManagedDocument
    {
        $this->assertTenant($actor, $document->tenant_id);

        $document->update([
            'legal_hold' => false,
            'legal_hold_reason' => null,
            'legal_hold_set_by' => null,
            'legal_hold_set_at' => null,
        ]);

        $this->audit($actor, 'document.legal_hold_released', $document, $document->currentVersion);

        AuditLog::record('document.legal_hold_released', [
            'auditable_type' => ManagedDocument::class,
            'auditable_id' => $document->id,
            'new_values' => ['legal_hold' => false],
            'tags' => ['document-service', 'legal-hold'],
        ]);

        return $document->fresh(['currentVersion']);
    }

    /**
     * @param  array{retention_policy?: ?string, retain_until?: ?string}  $data
     */
    public function setRetention(User $actor, ManagedDocument $document, array $data): ManagedDocument
    {
        $this->assertTenant($actor, $document->tenant_id);

        $document->update([
            'retention_policy' => $data['retention_policy'] ?? $document->retention_policy,
            'retain_until' => $data['retain_until'] ?? $document->retain_until,
        ]);

        $this->audit($actor, 'document.retention_updated', $document, $document->currentVersion, [
            'retention_policy' => $document->retention_policy,
            'retain_until' => $document->retain_until?->toDateString(),
        ]);

        return $document->fresh(['currentVersion']);
    }

    /**
     * Soft-purge metadata + remove version bytes unless legal hold blocks.
     */
    public function purge(User $actor, ManagedDocument $document): ManagedDocument
    {
        $this->assertTenant($actor, $document->tenant_id);
        $this->assertNotOnLegalHold($document);

        return DB::transaction(function () use ($actor, $document) {
            foreach ($document->versions as $version) {
                if ($version->storage_path) {
                    try {
                        Storage::disk($version->storage_disk ?: 'local')->delete($version->storage_path);
                    } catch (\Throwable) {
                        // continue — mark purged even if blob already gone
                    }
                }
            }

            $document->update([
                'purged_at' => now(),
                'purged_by' => $actor->id,
            ]);
            $document->delete();

            $this->audit($actor, 'document.purged', $document, null, [
                'versions' => $document->versions->pluck('id')->all(),
            ]);

            AuditLog::record('document.purged', [
                'auditable_type' => ManagedDocument::class,
                'auditable_id' => $document->id,
                'tags' => ['document-service', 'retention'],
            ]);

            return $document->fresh();
        });
    }

    public function assertNotOnLegalHold(ManagedDocument $document): void
    {
        if ($document->isOnLegalHold()) {
            throw ValidationException::withMessages([
                'legal_hold' => ['Cannot purge or destroy a document under legal hold. Release the hold first.'],
            ]);
        }
    }

    /**
     * Verify-by-hash — approved metadata only (no storage paths / tokens).
     *
     * @return array{verified: bool, matches?: list<array<string, mixed>>}
     */
    public function verifyByHash(string $hash, ?User $actor = null, bool $public = false): array
    {
        $hash = strtolower(trim($hash));
        if (! preg_match('/^[a-f0-9]{64}$/', $hash)) {
            throw ValidationException::withMessages([
                'hash' => ['Content hash must be a 64-character SHA-256 hex digest.'],
            ]);
        }

        $query = DocumentVersion::query()->where('content_hash', $hash)->with('document');
        if ($actor && ! $public) {
            $query->where('tenant_id', $actor->tenant_id);
        }

        $versions = $query->limit(25)->get();
        if ($versions->isEmpty()) {
            $this->audit($actor, 'document.verify_miss', null, null, [
                'content_hash' => $hash,
                'public' => $public,
            ]);

            return ['verified' => false, 'content_hash' => $hash];
        }

        $fields = $public
            ? (array) config('documents.verify_public_fields', [])
            : (array) config('documents.verify_internal_fields', []);

        $matches = $versions->map(function (DocumentVersion $version) use ($fields, $public) {
            $doc = $version->document;
            $row = [
                'verified' => true,
                'content_hash' => $version->content_hash,
                'version_number' => $version->version_number,
                'status' => $version->status,
                'is_immutable' => $version->is_immutable,
                'quarantine_status' => $version->quarantine_status,
                'scan_provider' => $version->scan_provider,
                'mime_type' => $version->mime_type,
                'size_bytes' => $version->size_bytes,
                'classification' => $doc?->classification,
                'module' => $doc?->module,
                'title' => $doc?->title,
                'document_id' => $doc?->id,
                'version_id' => $version->id,
                'finalized_at' => $version->finalized_at?->toIso8601String(),
                'legal_hold' => (bool) ($doc?->legal_hold),
            ];

            // Never expose storage paths / disks / notes on verify endpoints.
            unset($row['storage_path'], $row['storage_disk'], $row['notes']);

            if ($public) {
                unset($row['title'], $row['document_id'], $row['version_id'], $row['legal_hold']);
            }

            return array_intersect_key($row, array_flip($fields));
        })->values()->all();

        $this->audit($actor, 'document.verify_hit', $versions->first()?->document, $versions->first(), [
            'content_hash' => $hash,
            'public' => $public,
            'match_count' => count($matches),
        ]);

        return [
            'verified' => true,
            'content_hash' => $hash,
            'match_count' => count($matches),
            'matches' => $matches,
        ];
    }

    /**
     * Bridge helper: upload via Document Service and return linkage fields for module rows.
     *
     * @param  array{title?: string, module?: string, subject_type?: ?string, subject_id?: ?int, classification?: string, notes?: ?string}  $meta
     * @return array{document: ManagedDocument, version: DocumentVersion, storage_path: string, content_hash: string}
     */
    public function storeForModule(User $actor, UploadedFile $file, array $meta = []): array
    {
        $result = $this->upload($actor, $file, $meta);
        $version = $result['version'];

        return [
            'document' => $result['document'],
            'version' => $version,
            'storage_path' => $version->storage_path,
            'content_hash' => $version->content_hash,
            'managed_document_id' => $result['document']->id,
            'document_version_id' => $version->id,
            'mime_type' => $version->mime_type,
            'size_bytes' => $version->size_bytes,
            'original_filename' => $version->original_filename,
        ];
    }

    /**
     * Link an Attachment morph row onto a managed version (PIF / travel / leave, etc.).
     */
    public function linkAttachment(Attachment $attachment, DocumentVersion $version): Attachment
    {
        $attachment->forceFill([
            'storage_path' => $version->storage_path,
            'content_hash' => $version->content_hash,
            'managed_document_id' => $version->managed_document_id,
            'document_version_id' => $version->id,
            'mime_type' => $version->mime_type ?? $attachment->mime_type,
            'size_bytes' => $version->size_bytes ?? $attachment->size_bytes,
            'original_filename' => $version->original_filename ?: $attachment->original_filename,
        ])->save();

        return $attachment->fresh();
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
