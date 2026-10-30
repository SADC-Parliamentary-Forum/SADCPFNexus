<?php

namespace App\Modules\Documents\Services;

use App\Models\Attachment;
use App\Models\Documents\DocumentFileObject;
use App\Models\Documents\DocumentLink;
use App\Models\Documents\ManagedDocument;
use App\Models\User;
use App\Support\AttachmentFiles;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Cross-module contract: store binaries via Document Service, link (never overwrite),
 * unlink ≠ delete. Used by PIF / Travel / Leave / Procurement / Correspondence / Audit / HR.
 */
class ModuleDocumentBridge
{
    public function __construct(
        private readonly DocumentStorageService $documents,
    ) {}

    /**
     * Upload file into Document Service and create morph Attachment + DocumentLink.
     *
     * @param  array{document_type?: string, role?: string, title?: string, classification?: string, module?: string}  $opts
     */
    public function storeAttachment(
        User $actor,
        Model $attachable,
        UploadedFile $file,
        array $opts = []
    ): Attachment {
        $module = $opts['module'] ?? class_basename($attachable);
        $written = null;

        try {
            // Managed document, attachment row and link commit together: a
            // failure in any of them leaves no half-linked document behind.
            return DB::transaction(function () use ($actor, $attachable, $file, $opts, $module, &$written) {
                $stored = $this->documents->storeForModule($actor, $file, [
                    'title' => $opts['title'] ?? $file->getClientOriginalName(),
                    'module' => strtolower($module),
                    'subject_type' => $attachable::class,
                    'subject_id' => (int) $attachable->getKey(),
                    'classification' => $opts['classification'] ?? 'UNCLASSIFIED',
                    'document_type' => $opts['document_type'] ?? null,
                ]);
                $written = [
                    $stored['storage_path'],
                    DocumentFileObject::where('storage_path', $stored['storage_path'])->value('storage_disk'),
                ];

                /** @var Attachment $attachment */
                $attachment = $attachable->attachments()->create([
                    'tenant_id' => $actor->tenant_id,
                    'uploaded_by' => $actor->id,
                    'document_type' => $opts['document_type'] ?? 'other',
                    'original_filename' => $stored['original_filename'],
                    'storage_path' => $stored['storage_path'],
                    'mime_type' => $stored['mime_type'],
                    'size_bytes' => $stored['size_bytes'],
                    'content_hash' => $stored['content_hash'],
                    'managed_document_id' => $stored['managed_document_id'],
                    'document_version_id' => $stored['document_version_id'],
                ]);

                $this->documents->createLink(
                    $actor,
                    $stored['document'],
                    $stored['version'],
                    $attachable,
                    $opts['role'] ?? 'attachment',
                    $opts['document_type'] ?? null
                );

                return $attachment->load('uploader:id,name');
            });
        } catch (Throwable $e) {
            if ($written !== null) {
                $this->discardUnreferencedFile(...$written);
            }
            throw $e;
        }
    }

    /**
     * After a rolled-back upload, remove the stored blob unless a committed
     * row still points at it (content de-duplication reuses existing files).
     */
    private function discardUnreferencedFile(string $path, ?string $disk): void
    {
        if ($disk === null
            || DocumentFileObject::where('storage_path', $path)->exists()
            || Attachment::where('storage_path', $path)->exists()) {
            return;
        }

        try {
            Storage::disk($disk)->delete($path);
        } catch (Throwable $e) {
            Log::warning('documents.orphan_file', ['disk' => $disk, 'path' => $path, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Unlink attachment from subject. Does NOT destroy ManagedDocument / file object
     * when other active links remain (PRD §126: unlink ≠ delete).
     */
    public function unlinkAttachment(User $actor, Attachment $attachment): void
    {
        if ($attachment->managed_document_id) {
            DocumentLink::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('managed_document_id', $attachment->managed_document_id)
                ->where('linkable_type', $attachment->attachable_type)
                ->where('linkable_id', $attachment->attachable_id)
                ->whereNull('unlinked_at')
                ->update([
                    'unlinked_at' => now(),
                    'unlinked_by' => $actor->id,
                ]);

            $attachment->delete();

            return;
        }

        // Legacy ad-hoc path (pre-Document Service): row first, then the blob.
        AttachmentFiles::delete($attachment, $attachment->getStorageDisk());
    }
}
