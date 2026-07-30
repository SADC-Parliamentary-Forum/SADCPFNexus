<?php

namespace App\Modules\Documents\Services;

use App\Models\Attachment;
use App\Models\Documents\DocumentLink;
use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;

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
        $stored = $this->documents->storeForModule($actor, $file, [
            'title' => $opts['title'] ?? $file->getClientOriginalName(),
            'module' => strtolower($module),
            'subject_type' => $attachable::class,
            'subject_id' => (int) $attachable->getKey(),
            'classification' => $opts['classification'] ?? 'UNCLASSIFIED',
            'document_type' => $opts['document_type'] ?? null,
        ]);

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

        // Legacy ad-hoc path (pre-Document Service): remove orphan blob only.
        if ($attachment->storage_path && $attachment->existsOnDisk()) {
            \Illuminate\Support\Facades\Storage::disk($attachment->getStorageDisk())
                ->delete($attachment->storage_path);
        }
        $attachment->delete();
    }
}
