<?php

namespace App\Modules\Correspondence\Services;

use App\Models\Assignment;
use App\Models\AuditLog;
use App\Models\Correspondence;
use App\Models\CorrespondenceAssignmentLink;
use App\Models\CorrespondenceDispatch;
use App\Models\CorrespondenceNote;
use App\Models\CorrespondenceNumberingPolicy;
use App\Models\CorrespondenceOwner;
use App\Models\CorrespondenceReferenceLedger;
use App\Models\CorrespondenceRelationship;
use App\Models\CorrespondenceRoute;
use App\Models\CorrespondenceSubjectFile;
use App\Models\SignatureEvent;
use App\Models\User;
use App\Modules\Assignments\Services\AssignmentService;
use App\Modules\Documents\Services\DocumentStorageService;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CorrespondenceRegisterService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly AssignmentService $assignments,
        private readonly DocumentStorageService $documents,
    ) {}

    // ── Access control ────────────────────────────────────────────────────────

    public function accessibleQuery(User $user): Builder
    {
        $query = Correspondence::query()->where('tenant_id', $user->tenant_id);

        $resolver = app(\App\Modules\AccessControl\Services\AccessScopeResolver::class);
        $elevated = $this->isElevatedCorrespondenceUser($user);

        // Elevated registry/admin path — still deny-by-default for pure ICT via resolver.
        // Note: correspondence.registry alone does NOT unlock the full register (staff seeder includes it).
        if ($elevated) {
            return $resolver->constrainQuery($query, $user, 'created_by', [
                'module' => 'correspondence',
                'elevated' => true,
                'organisation' => true,
                'department_column' => 'department_id',
                'owner_columns' => ['created_by', 'primary_owner_id', 'registered_by', 'approved_by'],
            ]);
        }

        // Party-only deny-by-default: own / owned / routed — not all open-confidentiality rows.
        $query->where(function (Builder $q) use ($user) {
            $q->where('created_by', $user->id)
                ->orWhere('primary_owner_id', $user->id)
                ->orWhere('registered_by', $user->id)
                ->orWhere('approved_by', $user->id)
                ->orWhereHas('owners', fn (Builder $o) => $o->where('user_id', $user->id))
                ->orWhereHas('routes', function (Builder $r) use ($user) {
                    $r->where('primary_owner_id', $user->id)
                        ->orWhere('routed_by', $user->id)
                        ->orWhereJsonContains('supporting_owner_ids', $user->id)
                        ->orWhereJsonContains('copy_to_user_ids', $user->id);
                });
        });

        // Content-restricted: metadata only unless party — still visible as row,
        // but show() redacts body/file. List remains scoped above.
        return $query;
    }

    public function assertCanAccess(Correspondence $c, User $user): void
    {
        abort_unless((int) $c->tenant_id === (int) $user->tenant_id, 404);

        if ($this->isElevatedCorrespondenceUser($user)) {
            return;
        }

        $allowed = $this->accessibleQuery($user)->where('id', $c->id)->exists();
        abort_unless($allowed, 403, 'Confidential correspondence access denied.');
    }

    public function canViewContent(Correspondence $c, User $user): bool
    {
        if (! $c->content_restricted && ! in_array($c->confidentiality, Correspondence::RESTRICTED_CONFIDENTIALITY, true)) {
            return true;
        }

        if ($this->isElevatedCorrespondenceUser($user)) {
            return true;
        }

        return (int) $c->created_by === (int) $user->id
            || (int) $c->primary_owner_id === (int) $user->id
            || (int) $c->approved_by === (int) $user->id
            || $c->owners()->where('user_id', $user->id)->exists()
            || $c->routes()->where(function ($r) use ($user) {
                $r->where('primary_owner_id', $user->id)
                    ->orWhere('routed_by', $user->id)
                    ->orWhereJsonContains('supporting_owner_ids', $user->id);
            })->exists();
    }

    private function isElevatedCorrespondenceUser(User $user): bool
    {
        if ($user->isSystemAdmin()) {
            return true;
        }

        foreach ([
            'correspondence.admin',
            'correspondence.confidential.view',
            'correspondence.read.confidential',
        ] as $permission) {
            if ($user->can($permission)) {
                return true;
            }
        }

        return false;
    }

    public function redactForUser(Correspondence $c, User $user): Correspondence
    {
        if ($this->canViewContent($c, $user)) {
            return $c;
        }

        $c->setAttribute('body', null);
        $c->setAttribute('summary', '[Restricted — content not available]');
        $c->setAttribute('file_path', null);
        $c->setAttribute('original_filename', null);
        $c->setRelation('notes', collect());

        return $c;
    }

    // ── Incoming registration ─────────────────────────────────────────────────

    public function registerIncoming(User $user, array $data, ?UploadedFile $file = null): Correspondence
    {
        return DB::transaction(function () use ($user, $data, $file) {
            $filePath = null;
            $originalFilename = null;
            $mimeType = null;
            $sizeBytes = null;
            $contentHash = null;
            $managedDocumentId = null;
            $documentVersionId = null;

            if ($file) {
                $stored = $this->documents->storeForModule($user, $file, [
                    'title' => $data['title'] ?? $file->getClientOriginalName(),
                    'module' => 'correspondence',
                    'document_type' => 'correspondence_original',
                    'classification' => strtoupper((string) ($data['confidentiality'] ?? 'UNCLASSIFIED')),
                ]);
                $filePath = $stored['storage_path'];
                $originalFilename = $stored['original_filename'];
                $mimeType = $stored['mime_type'];
                $sizeBytes = $stored['size_bytes'];
                $contentHash = $stored['content_hash'];
                $managedDocumentId = $stored['managed_document_id'];
                $documentVersionId = $stored['document_version_id'];
            }

            $ledger = $this->allocateReference($user, 'incoming', 'default', [
                'file' => $data['file_code'] ?? 'GEN',
            ]);

            $confidentiality = $data['confidentiality'] ?? 'general_official';
            $contentRestricted = (bool) ($data['content_restricted'] ?? false)
                || in_array($confidentiality, ['confidential', 'highly_confidential', 'privileged_legal'], true);

            $c = Correspondence::create([
                'tenant_id' => $user->tenant_id,
                'created_by' => $user->id,
                'registered_by' => $user->id,
                'registered_at' => now(),
                'title' => $data['title'],
                'subject' => $data['subject'],
                'body' => $data['body'] ?? null,
                'summary' => $data['summary'] ?? null,
                'type' => $data['type'] ?? 'external',
                'priority' => $data['priority'] ?? 'normal',
                'language' => $data['language'] ?? 'en',
                'direction' => 'incoming',
                'status' => 'pending_sg_routing',
                'file_code' => $data['file_code'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'programme_id' => $data['programme_id'] ?? null,
                'registry_reference' => $ledger->reference,
                'reference_number' => $ledger->reference,
                'correspondence_date' => $data['correspondence_date'] ?? null,
                'received_at' => $data['received_at'] ?? now(),
                'channel' => $data['channel'] ?? 'post',
                'sender_name' => $data['sender_name'] ?? null,
                'sender_organisation' => $data['sender_organisation'] ?? null,
                'sender_country' => $data['sender_country'] ?? null,
                'sender_reference' => $data['sender_reference'] ?? null,
                'message_id' => $data['message_id'] ?? null,
                'mailbox_source' => $data['mailbox_source'] ?? null,
                'sender_contact_id' => $data['sender_contact_id'] ?? null,
                'attention_to' => $data['attention_to'] ?? null,
                'confidentiality' => $confidentiality,
                'content_restricted' => $contentRestricted,
                'response_required' => (bool) ($data['response_required'] ?? false),
                'sender_deadline' => $data['sender_deadline'] ?? null,
                'internal_deadline' => $data['internal_deadline'] ?? null,
                'final_deadline' => $data['final_deadline'] ?? null,
                'physical_location' => $data['physical_location'] ?? null,
                'file_path' => $filePath,
                'original_filename' => $originalFilename,
                'mime_type' => $mimeType,
                'size_bytes' => $sizeBytes,
                'content_hash' => $contentHash,
                'managed_document_id' => $managedDocumentId,
                'document_version_id' => $documentVersionId,
                'original_immutable_at' => $filePath ? now() : null,
            ]);

            $ledger->update(['correspondence_id' => $c->id]);

            if (! empty($data['subject_file_id'])) {
                $this->linkSubjectFile($c, (int) $data['subject_file_id'], true);
            }

            AuditLog::record('correspondence.registered', [
                'auditable_type' => Correspondence::class,
                'auditable_id' => $c->id,
                'new_values' => [
                    'registry_reference' => $c->registry_reference,
                    'status' => $c->status,
                    'confidentiality' => $c->confidentiality,
                ],
            ]);

            return $c->fresh(['creator:id,name,email', 'department:id,name']);
        });
    }

    // ── Reference allocation ──────────────────────────────────────────────────

    public function allocateReference(
        User $user,
        string $direction,
        string $series = 'default',
        array $tokens = []
    ): CorrespondenceReferenceLedger {
        return DB::transaction(function () use ($user, $direction, $series, $tokens) {
            $policy = CorrespondenceNumberingPolicy::forTenant($user->tenant_id);
            $year = (int) now()->year;

            $last = CorrespondenceReferenceLedger::where('tenant_id', $user->tenant_id)
                ->where('direction', $direction)
                ->where('year', $year)
                ->where('series', $series)
                ->lockForUpdate()
                ->orderByDesc('sequence')
                ->first();

            $sequence = ($last?->sequence ?? 0) + 1;
            $padding = $direction === 'incoming'
                ? $policy->incoming_seq_padding
                : $policy->outgoing_seq_padding;
            $pattern = $direction === 'incoming'
                ? $policy->incoming_pattern
                : $policy->outgoing_pattern;

            $reference = $this->formatReference($pattern, $padding, $year, $sequence, $tokens);

            // Uniqueness enforced by DB; retry once on collision (should not happen under lock)
            return CorrespondenceReferenceLedger::create([
                'tenant_id' => $user->tenant_id,
                'direction' => $direction,
                'year' => $year,
                'series' => $series,
                'sequence' => $sequence,
                'reference' => $reference,
                'status' => 'active',
                'created_by' => $user->id,
            ]);
        });
    }

    public function allocateOutgoingReference(Correspondence $c, User $actor): string
    {
        $policy = CorrespondenceNumberingPolicy::forTenant($c->tenant_id);
        if ($c->reference_number) {
            return $c->reference_number;
        }

        $preparer = $c->creator ?? $actor;
        $ledger = $this->allocateReference($actor, 'outgoing', $c->file_code ?: 'default', [
            'file' => $c->file_code ?: 'GEN',
            'signatory' => $c->signatory_code ?: 'SG',
            'preparer' => Correspondence::extractInitials($preparer->name),
        ]);

        $ledger->update(['correspondence_id' => $c->id]);
        $c->update([
            'reference_number' => $ledger->reference,
            'registry_reference' => $c->registry_reference ?: $ledger->reference,
        ]);

        return $ledger->reference;
    }

    public function voidReference(Correspondence $c, User $user, string $reason): Correspondence
    {
        return DB::transaction(function () use ($c, $reason) {
            $refs = array_filter([$c->reference_number, $c->registry_reference]);
            CorrespondenceReferenceLedger::where('tenant_id', $c->tenant_id)
                ->whereIn('reference', $refs)
                ->update([
                    'status' => 'voided',
                    'void_reason' => $reason,
                ]);

            $c->update([
                'status' => 'voided',
                'voided_at' => now(),
                'void_reason' => $reason,
            ]);

            AuditLog::record('correspondence.reference_voided', [
                'auditable_type' => Correspondence::class,
                'auditable_id' => $c->id,
                'new_values' => ['void_reason' => $reason, 'refs' => $refs],
            ]);

            return $c->fresh();
        });
    }

    private function formatReference(string $pattern, int $padding, int $year, int $sequence, array $tokens): string
    {
        $seq = str_pad((string) $sequence, $padding, '0', STR_PAD_LEFT);
        $map = [
            '{year}' => (string) $year,
            '{seq}' => $seq,
            '{file}' => strtoupper($tokens['file'] ?? 'GEN'),
            '{signatory}' => strtoupper($tokens['signatory'] ?? 'SG'),
            '{preparer}' => strtoupper($tokens['preparer'] ?? 'XX'),
        ];

        return str_replace(array_keys($map), array_values($map), $pattern);
    }

    // ── SG routing ────────────────────────────────────────────────────────────

    public function sgRoute(Correspondence $c, User $user, array $data): Correspondence
    {
        if ($c->direction !== 'incoming') {
            throw ValidationException::withMessages(['direction' => 'Only incoming correspondence is SG-routed.']);
        }

        $action = $data['action'];
        $needsOwner = in_array($action, [
            'route_for_action', 'route_for_advice', 'route_for_draft_response', 'route_for_comment', 'route_to_multiple',
        ], true);

        if ($needsOwner && empty($data['primary_owner_id'])) {
            throw ValidationException::withMessages([
                'primary_owner_id' => 'A Primary Action Owner is required for actionable routing.',
            ]);
        }

        return DB::transaction(function () use ($c, $user, $data, $action, $needsOwner) {
            $primaryId = $data['primary_owner_id'] ?? null;
            $supporting = array_values(array_filter($data['supporting_owner_ids'] ?? []));
            $supporting = array_values(array_diff($supporting, [$primaryId]));

            $route = CorrespondenceRoute::create([
                'correspondence_id' => $c->id,
                'routed_by' => $user->id,
                'action' => $action,
                'primary_owner_id' => $primaryId,
                'department_id' => $data['department_id'] ?? null,
                'instruction' => $data['instruction'] ?? null,
                'priority' => $data['priority'] ?? $c->priority,
                'due_date' => $data['due_date'] ?? null,
                'response_required' => (bool) ($data['response_required'] ?? $c->response_required),
                'response_due_date' => $data['response_due_date'] ?? null,
                'copy_to_user_ids' => $data['copy_to_user_ids'] ?? [],
                'supporting_owner_ids' => $supporting,
            ]);

            // Reset owners for fresh routing assignment
            if ($needsOwner && $primaryId) {
                CorrespondenceOwner::where('correspondence_id', $c->id)->delete();

                CorrespondenceOwner::create([
                    'correspondence_id' => $c->id,
                    'user_id' => $primaryId,
                    'department_id' => $data['department_id'] ?? null,
                    'role' => 'primary',
                    'action_required' => $action,
                    'instruction' => $data['instruction'] ?? null,
                    'due_date' => $data['due_date'] ?? null,
                ]);

                foreach ($supporting as $sid) {
                    CorrespondenceOwner::create([
                        'correspondence_id' => $c->id,
                        'user_id' => $sid,
                        'role' => 'supporting',
                        'action_required' => $action,
                        'instruction' => $data['instruction'] ?? null,
                        'due_date' => $data['due_date'] ?? null,
                    ]);
                }
            }

            $newStatus = match ($action) {
                'close_no_action', 'acknowledge_receipt' => 'closed',
                'for_information' => 'routed',
                default => 'routed',
            };

            if ($needsOwner) {
                $newStatus = 'in_progress';
            }

            $c->update([
                'status' => $newStatus,
                'primary_owner_id' => $primaryId ?? $c->primary_owner_id,
                'sg_action' => $action,
                'sg_instruction' => $data['instruction'] ?? null,
                'priority' => $data['priority'] ?? $c->priority,
                'response_required' => (bool) ($data['response_required'] ?? $c->response_required),
                'internal_deadline' => $data['due_date'] ?? $c->internal_deadline,
                'final_deadline' => $data['response_due_date'] ?? $c->final_deadline,
            ]);

            $notifyIds = array_unique(array_filter(array_merge(
                [$primaryId],
                $supporting,
                $data['copy_to_user_ids'] ?? []
            )));

            foreach ($notifyIds as $uid) {
                $recipient = User::find($uid);
                if ($recipient) {
                    $this->notifications->dispatch(
                        $recipient,
                        'correspondence.routed',
                        [
                            'name' => $recipient->name,
                            'reference' => $c->registry_reference ?? $c->reference_number ?? ('#'.$c->id),
                            'subject' => $c->subject,
                        ],
                        [
                            'module' => 'correspondence',
                            'record_id' => $c->id,
                            'url' => '/correspondence/'.$c->id,
                            'trigger' => 'correspondence.routed',
                        ],
                        false,
                        true
                    );
                }
            }

            AuditLog::record('correspondence.sg_routed', [
                'auditable_type' => Correspondence::class,
                'auditable_id' => $c->id,
                'new_values' => [
                    'action' => $action,
                    'primary_owner_id' => $primaryId,
                    'route_id' => $route->id,
                ],
            ]);

            return $c->fresh([
                'primaryOwner:id,name,email',
                'owners.user:id,name,email',
                'routes.router:id,name',
            ]);
        });
    }

    public function acknowledge(Correspondence $c, User $user, string $ackStatus): CorrespondenceOwner
    {
        $owner = CorrespondenceOwner::where('correspondence_id', $c->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $owner) {
            throw ValidationException::withMessages(['user' => 'You are not an assigned owner of this correspondence.']);
        }

        $owner->update([
            'ack_status' => $ackStatus,
            'acknowledged_at' => now(),
        ]);

        if ($ackStatus === 'misrouted') {
            $c->update(['status' => 'misrouted']);
        } elseif ($ackStatus === 'accepted' && $c->status === 'routed') {
            $c->update(['status' => 'in_progress']);
        }

        AuditLog::record('correspondence.acknowledged', [
            'auditable_type' => Correspondence::class,
            'auditable_id' => $c->id,
            'new_values' => ['ack_status' => $ackStatus, 'user_id' => $user->id],
        ]);

        return $owner->fresh('user:id,name');
    }

    // ── Notes / relationships ─────────────────────────────────────────────────

    public function addNote(Correspondence $c, User $user, string $body): CorrespondenceNote
    {
        $note = CorrespondenceNote::create([
            'correspondence_id' => $c->id,
            'user_id' => $user->id,
            'body' => $body,
            'visibility' => 'internal',
        ]);

        AuditLog::record('correspondence.note_added', [
            'auditable_type' => Correspondence::class,
            'auditable_id' => $c->id,
            'new_values' => ['note_id' => $note->id],
        ]);

        return $note->load('author:id,name');
    }

    public function linkRelationship(
        Correspondence $from,
        Correspondence $to,
        string $type,
        User $user
    ): CorrespondenceRelationship {
        abort_unless((int) $from->tenant_id === (int) $to->tenant_id, 422);

        $rel = CorrespondenceRelationship::firstOrCreate(
            [
                'from_correspondence_id' => $from->id,
                'to_correspondence_id' => $to->id,
                'type' => $type,
            ],
            ['created_by' => $user->id]
        );

        if (in_array($type, ['reply_to', 'response_to', 'thread'], true)) {
            $rootId = $to->thread_root_id ?: $to->id;
            if (! $from->thread_root_id) {
                $from->update(['thread_root_id' => $rootId]);
            }
            if (! $to->thread_root_id && $to->id !== $rootId) {
                $to->update(['thread_root_id' => $rootId]);
            }
        }

        return $rel;
    }

    // ── Subject files ─────────────────────────────────────────────────────────

    public function createSubjectFile(User $user, array $data): CorrespondenceSubjectFile
    {
        return CorrespondenceSubjectFile::create([
            'tenant_id' => $user->tenant_id,
            'file_code' => strtoupper($data['file_code']),
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'parent_id' => $data['parent_id'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    public function linkSubjectFile(Correspondence $c, int $subjectFileId, bool $isPrimary = false): void
    {
        $file = CorrespondenceSubjectFile::where('tenant_id', $c->tenant_id)->findOrFail($subjectFileId);

        if ($isPrimary) {
            DB::table('correspondence_file_links')
                ->where('correspondence_id', $c->id)
                ->update(['is_primary' => false]);
        }

        $c->subjectFiles()->syncWithoutDetaching([
            $file->id => ['is_primary' => $isPrimary],
        ]);

        if ($isPrimary && ! $c->file_code) {
            $c->update(['file_code' => $file->file_code]);
        }
    }

    // ── Signing / dispatch ────────────────────────────────────────────────────

    public function sign(Correspondence $c, User $user, ?string $comment = null): Correspondence
    {
        if (! $c->isApproved() && $c->status !== 'approved') {
            throw ValidationException::withMessages(['status' => 'Correspondence must be approved before signing.']);
        }

        if ($c->isSignedImmutable()) {
            throw ValidationException::withMessages(['status' => 'Signed correspondence is immutable.']);
        }

        return DB::transaction(function () use ($c, $user, $comment) {
            if (! $c->reference_number) {
                $this->allocateOutgoingReference($c, $user);
            }

            $hash = $c->file_path && Storage::disk('local')->exists($c->file_path)
                ? hash_file('sha256', Storage::disk('local')->path($c->file_path))
                : hash('sha256', ($c->body ?? '').'|'.$c->subject.'|'.$c->id);

            $event = SignatureEvent::create([
                'tenant_id' => $c->tenant_id,
                'signable_type' => Correspondence::class,
                'signable_id' => $c->id,
                'step_key' => 'correspondence_sign',
                'signer_user_id' => $user->id,
                'action' => 'approve',
                'comment' => $comment,
                'auth_level' => 'session',
                'ip_address' => request()->ip(),
                'user_agent' => substr((string) request()->userAgent(), 0, 512),
                'document_hash' => $hash,
                'signed_at' => now(),
            ]);

            $c->update([
                'status' => 'ready_dispatch',
                'signed_by' => $user->id,
                'signed_immutable_at' => now(),
                'signature_event_id' => $event->id,
                'letterhead_applied_at' => $c->letterhead_applied_at ?? now(),
            ]);

            AuditLog::record('correspondence.signed', [
                'auditable_type' => Correspondence::class,
                'auditable_id' => $c->id,
                'new_values' => ['signature_event_id' => $event->id],
            ]);

            return $c->fresh();
        });
    }

    public function assertMutable(Correspondence $c, bool $fileChange = false): void
    {
        if ($c->isVoided()) {
            throw ValidationException::withMessages(['status' => 'Voided correspondence cannot be modified.']);
        }
        if ($c->isSignedImmutable()) {
            throw ValidationException::withMessages(['status' => 'Signed outgoing correspondence is immutable.']);
        }
        if ($fileChange && $c->isOriginalImmutable()) {
            throw ValidationException::withMessages(['file' => 'Registered original document is immutable.']);
        }
    }

    public function dispatchRecord(Correspondence $c, User $user, array $data): CorrespondenceDispatch
    {
        if (! $c->canDispatch()) {
            throw ValidationException::withMessages([
                'status' => 'Correspondence must be approved (and preferably signed) before dispatch.',
            ]);
        }

        return DB::transaction(function () use ($c, $user, $data) {
            if (! $c->reference_number && $c->direction === 'outgoing') {
                $this->allocateOutgoingReference($c, $user);
            }

            $dispatch = CorrespondenceDispatch::create([
                'correspondence_id' => $c->id,
                'dispatched_by' => $user->id,
                'channel' => $data['channel'],
                'dispatched_at' => $data['dispatched_at'] ?? now(),
                'tracking_reference' => $data['tracking_reference'] ?? null,
                'delivery_status' => $data['delivery_status'] ?? 'dispatched',
                'delivered_at' => $data['delivered_at'] ?? null,
                'recipient_name' => $data['recipient_name'] ?? null,
                'evidence_notes' => $data['evidence_notes'] ?? null,
            ]);

            $c->update([
                'status' => 'sent',
                'sent_at' => $dispatch->dispatched_at,
            ]);

            AuditLog::record('correspondence.dispatched', [
                'auditable_type' => Correspondence::class,
                'auditable_id' => $c->id,
                'new_values' => [
                    'dispatch_id' => $dispatch->id,
                    'channel' => $dispatch->channel,
                ],
            ]);

            return $dispatch->load('dispatcher:id,name');
        });
    }

    public function updateDelivery(CorrespondenceDispatch $dispatch, array $data): CorrespondenceDispatch
    {
        $dispatch->update([
            'delivery_status' => $data['delivery_status'] ?? $dispatch->delivery_status,
            'delivered_at' => $data['delivered_at'] ?? $dispatch->delivered_at,
            'tracking_reference' => $data['tracking_reference'] ?? $dispatch->tracking_reference,
            'evidence_notes' => $data['evidence_notes'] ?? $dispatch->evidence_notes,
        ]);

        return $dispatch->fresh();
    }

    // ── Assignments ───────────────────────────────────────────────────────────

    public function linkAssignment(Correspondence $c, User $user, ?int $assignmentId = null, ?array $create = null): CorrespondenceAssignmentLink
    {
        return DB::transaction(function () use ($c, $user, $assignmentId, $create) {
            if ($assignmentId) {
                $assignment = Assignment::where('tenant_id', $c->tenant_id)->findOrFail($assignmentId);
            } elseif ($create) {
                $due = $create['due_date'] ?? $c->internal_deadline?->toDateString() ?? $c->final_deadline?->toDateString();
                if (! $due) {
                    $due = now()->addDays(7)->toDateString();
                }

                $priority = match ($c->priority) {
                    'urgent' => 'urgent',
                    'high' => 'high',
                    'low' => 'low',
                    default => 'medium',
                };

                $assignment = $this->assignments->createFromSource([
                    'title' => $create['title'] ?? ('Action: '.($c->subject ?: $c->title)),
                    'description' => $create['description'] ?? ($c->sg_instruction ?: ($c->summary ?: $c->subject ?: $c->title)),
                    'type' => $create['type'] ?? 'individual',
                    'priority' => $create['priority'] ?? $priority,
                    'assigned_to' => $create['assigned_to'] ?? $c->primary_owner_id,
                    'department_id' => $create['department_id'] ?? $c->department_id,
                    'due_date' => $due,
                    'source_type' => 'correspondence',
                    'source_id' => $c->id,
                    'source_purpose' => $create['source_purpose'] ?? 'action',
                    'source_reference' => $c->reference_number ?? $c->registry_reference,
                    'source_title' => $c->subject ?: $c->title,
                    'source_confidential' => in_array($c->confidentiality, Correspondence::RESTRICTED_CONFIDENTIALITY, true),
                    'is_confidential' => in_array($c->confidentiality, Correspondence::RESTRICTED_CONFIDENTIALITY, true),
                ], $user);
            } else {
                throw ValidationException::withMessages(['assignment' => 'Provide assignment_id or create payload.']);
            }

            $link = CorrespondenceAssignmentLink::firstOrCreate(
                [
                    'correspondence_id' => $c->id,
                    'assignment_id' => $assignment->id,
                ],
                ['created_by' => $user->id]
            );

            AuditLog::record('correspondence.assignment_linked', [
                'auditable_type' => Correspondence::class,
                'auditable_id' => $c->id,
                'new_values' => ['assignment_id' => $assignment->id],
            ]);

            return $link->load('assignment');
        });
    }

    // ── Queries / reports ─────────────────────────────────────────────────────

    public function masterRegister(User $user, array $filters): LengthAwarePaginator
    {
        $query = $this->accessibleQuery($user)
            ->with(['creator:id,name', 'primaryOwner:id,name', 'department:id,name'])
            ->where(function (Builder $q) {
                $q->whereNotNull('registered_at')
                    ->orWhereNotNull('approved_at')
                    ->orWhereNotNull('reference_number');
            })
            ->orderByDesc(DB::raw('COALESCE(received_at, approved_at, created_at)'));

        if (! empty($filters['direction'])) {
            $query->where('direction', $filters['direction']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function (Builder $q) use ($search) {
                $q->where('subject', 'ilike', "%{$search}%")
                    ->orWhere('title', 'ilike', "%{$search}%")
                    ->orWhere('reference_number', 'ilike', "%{$search}%")
                    ->orWhere('registry_reference', 'ilike', "%{$search}%")
                    ->orWhere('sender_name', 'ilike', "%{$search}%")
                    ->orWhere('sender_organisation', 'ilike', "%{$search}%");
            });
        }

        return $query->paginate(min((int) ($filters['per_page'] ?? 25), 100));
    }

    public function myActions(User $user, array $filters): LengthAwarePaginator
    {
        return $this->accessibleQuery($user)
            ->with(['primaryOwner:id,name', 'owners'])
            ->where(function (Builder $q) use ($user) {
                $q->where('primary_owner_id', $user->id)
                    ->orWhereHas('owners', fn (Builder $o) => $o->where('user_id', $user->id));
            })
            ->whereNotIn('status', ['closed', 'archived', 'voided', 'sent'])
            ->orderByRaw('CASE WHEN final_deadline IS NULL THEN 1 ELSE 0 END')
            ->orderBy('final_deadline')
            ->paginate(min((int) ($filters['per_page'] ?? 25), 100));
    }

    public function reportSummary(User $user): array
    {
        $base = $this->accessibleQuery($user);

        return [
            'incoming_pending_routing' => (clone $base)->where('direction', 'incoming')->where('status', 'pending_sg_routing')->count(),
            'incoming_in_progress' => (clone $base)->where('direction', 'incoming')->whereIn('status', ['routed', 'in_progress'])->count(),
            'outgoing_pending_approval' => (clone $base)->where('direction', 'outgoing')->where('status', 'pending_approval')->count(),
            'ready_for_dispatch' => (clone $base)->whereIn('status', ['approved', 'signed', 'ready_dispatch'])->count(),
            'overdue' => (clone $base)->whereNotIn('status', ['closed', 'archived', 'voided', 'sent'])
                ->whereNotNull('final_deadline')
                ->whereDate('final_deadline', '<', now())
                ->count(),
            'my_open_actions' => (clone $base)->where('primary_owner_id', $user->id)
                ->whereNotIn('status', ['closed', 'archived', 'voided', 'sent'])
                ->count(),
        ];
    }
}
