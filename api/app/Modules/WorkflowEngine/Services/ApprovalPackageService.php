<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\ApprovalRequest;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowApprovalPackage;
use App\Models\WorkflowEngine\WorkflowAuditEvent;
use App\Modules\Documents\Services\DocumentStorageService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

/**
 * Submission approval package + field locking (PRD §45–§48, §124).
 */
class ApprovalPackageService
{
    /** Default material fields locked after submit — modules may override via context. */
    public const DEFAULT_LOCKED_FIELDS = [
        'amount', 'currency', 'purpose', 'start_date', 'end_date',
        'departure_date', 'return_date', 'destination_country', 'destination_city',
        'estimated_dsa', 'requested_amount', 'title', 'budget_code',
    ];

    public function capture(
        ApprovalRequest $request,
        Model $entity,
        User $actor,
        array $lockedFields = [],
        ?array $previousPackage = null
    ): WorkflowApprovalPackage {
        $fields = $this->snapshotFields($entity);
        $documents = $this->snapshotDocuments($entity);
        $locked = $lockedFields !== [] ? $lockedFields : self::DEFAULT_LOCKED_FIELDS;
        $hash = hash('sha256', json_encode(['fields' => $fields, 'documents' => $documents]));

        $version = (int) WorkflowApprovalPackage::where('approval_request_id', $request->id)->max('package_version') + 1;
        $diff = null;
        if ($previousPackage) {
            $diff = $this->diff($previousPackage['field_snapshot'] ?? [], $fields);
        } elseif ($version > 1) {
            $prev = WorkflowApprovalPackage::where('approval_request_id', $request->id)
                ->where('package_version', $version - 1)
                ->first();
            if ($prev) {
                $diff = $this->diff($prev->field_snapshot ?? [], $fields);
            }
        }

        $package = WorkflowApprovalPackage::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'package_version' => $version,
            'package_hash' => $hash,
            'field_snapshot' => $fields,
            'document_snapshot' => $documents,
            'locked_fields' => $locked,
            'diff_from_previous' => $diff,
            'created_by' => $actor->id,
            'locked_at' => now(),
        ]);

        $request->update([
            'approval_package_hash' => $hash,
            'record_version' => $version,
            'locked_at' => now(),
        ]);

        WorkflowAuditEvent::create([
            'tenant_id' => $request->tenant_id,
            'approval_request_id' => $request->id,
            'event_type' => 'ApprovalPackageCaptured',
            'actor_user_id' => $actor->id,
            'payload' => [
                'package_version' => $version,
                'package_hash' => $hash,
                'has_material_diff' => ! empty($diff),
            ],
            'occurred_at' => now(),
        ]);

        return $package;
    }

    public function assertUnchanged(ApprovalRequest $request, Model $entity): void
    {
        if (! $request->approval_package_hash) {
            return;
        }

        $package = WorkflowApprovalPackage::where('approval_request_id', $request->id)
            ->orderByDesc('package_version')
            ->first();
        if (! $package) {
            return;
        }

        $locked = $package->locked_fields ?? self::DEFAULT_LOCKED_FIELDS;
        $before = $package->field_snapshot ?? [];
        $after = $this->snapshotFields($entity);
        $materialDiff = [];
        foreach ($locked as $field) {
            if (! array_key_exists($field, $before) && ! array_key_exists($field, $after)) {
                continue;
            }
            $b = $this->normalizeComparable($before[$field] ?? null);
            $a = $this->normalizeComparable($after[$field] ?? null);
            if ($b !== $a) {
                $materialDiff[$field] = ['from' => $b, 'to' => $a];
            }
        }

        if ($materialDiff !== []) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'record' => 'The record has changed since submission. Material changes require resubmission and re-approval.',
            ]);
        }
    }

    private function normalizeComparable(mixed $value): mixed
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
            return substr($value, 0, 10);
        }
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_numeric($value) && ! is_string($value)) {
            return (string) $value;
        }

        return $value;
    }

    public function isMaterialChange(array $diff): bool
    {
        if ($diff === []) {
            return false;
        }
        $material = array_intersect(array_keys($diff), self::DEFAULT_LOCKED_FIELDS);

        return $material !== [];
    }

    private function snapshotFields(Model $entity): array
    {
        $attrs = Arr::except($entity->getAttributes(), [
            'updated_at', 'created_at', 'deleted_at', 'password', 'remember_token',
        ]);
        ksort($attrs);

        return $attrs;
    }

    private function snapshotDocuments(Model $entity): array
    {
        if (! method_exists($entity, 'attachments') && ! method_exists($entity, 'documents')) {
            return [];
        }

        $docs = [];
        $documentService = app(DocumentStorageService::class);

        if (method_exists($entity, 'attachments')) {
            foreach ($entity->attachments()->get() as $att) {
                $hash = $att->content_hash ?? null;
                if (! $hash) {
                    try {
                        $hash = $documentService->syncAttachmentHash($att);
                    } catch (\Throwable) {
                        $hash = null;
                    }
                }
                $docs[] = [
                    'id' => $att->id,
                    'name' => $att->original_filename ?? $att->name ?? null,
                    'path' => $att->storage_path ?? $att->path ?? null,
                    'hash' => $hash,
                    'managed_document_id' => $att->managed_document_id ?? null,
                    'document_version_id' => $att->document_version_id ?? null,
                ];
            }
        }
        if (method_exists($entity, 'documents')) {
            foreach ($entity->documents()->get() as $doc) {
                $docs[] = [
                    'id' => $doc->id,
                    'name' => $doc->title ?? $doc->name ?? null,
                    'path' => $doc->storage_path ?? $doc->path ?? null,
                    'hash' => $doc->content_hash ?? null,
                    'managed_document_id' => $doc->managed_document_id ?? null,
                    'document_version_id' => $doc->document_version_id ?? null,
                ];
            }
        }

        return $docs;
    }

    private function diff(array $before, array $after): array
    {
        $changed = [];
        $keys = array_unique(array_merge(array_keys($before), array_keys($after)));
        foreach ($keys as $key) {
            $b = $before[$key] ?? null;
            $a = $after[$key] ?? null;
            if ($b != $a) {
                $changed[$key] = ['from' => $b, 'to' => $a];
            }
        }

        return $changed;
    }
}
