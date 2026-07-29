<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Correspondence extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'correspondence';

    public const OPEN_CONFIDENTIALITY = ['internal', 'general_official'];

    public const RESTRICTED_CONFIDENTIALITY = [
        'restricted', 'confidential', 'highly_confidential',
        'privileged_legal', 'hr_confidential', 'finance_confidential',
    ];

    protected $fillable = [
        'tenant_id', 'created_by', 'reviewed_by', 'approved_by',
        'reference_number', 'registry_reference', 'title', 'subject', 'body',
        'type', 'priority', 'language', 'status', 'direction',
        'file_code', 'signatory_code', 'department_id', 'programme_id',
        'file_path', 'original_filename', 'mime_type', 'size_bytes',
        'review_comment', 'rejection_reason',
        'submitted_at', 'reviewed_at', 'approved_at', 'sent_at',
        'correspondence_date', 'received_at', 'channel',
        'sender_name', 'sender_organisation', 'sender_country', 'sender_reference',
        'message_id', 'mailbox_source',
        'sender_contact_id', 'attention_to', 'summary', 'confidentiality',
        'content_restricted', 'primary_owner_id', 'response_required',
        'sender_deadline', 'internal_deadline', 'final_deadline',
        'original_immutable_at', 'signed_immutable_at', 'signed_by',
        'signature_event_id', 'letterhead_applied_at',
        'voided_at', 'void_reason', 'thread_root_id', 'physical_location',
        'registered_by', 'registered_at', 'sg_instruction', 'sg_action',
        'ai_draft_subject', 'ai_draft_body', 'ai_draft_confirmed_at', 'ai_draft_confirmed_by',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'reviewed_at'  => 'datetime',
        'approved_at'  => 'datetime',
        'sent_at'      => 'datetime',
        'received_at'  => 'datetime',
        'registered_at'=> 'datetime',
        'original_immutable_at' => 'datetime',
        'signed_immutable_at' => 'datetime',
        'letterhead_applied_at' => 'datetime',
        'voided_at' => 'datetime',
        'ai_draft_confirmed_at' => 'datetime',
        'correspondence_date' => 'date',
        'sender_deadline' => 'date',
        'internal_deadline' => 'date',
        'final_deadline' => 'date',
        'size_bytes'   => 'integer',
        'content_restricted' => 'boolean',
        'response_required' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function primaryOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'primary_owner_id');
    }

    public function registeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registered_by');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function senderContact(): BelongsTo
    {
        return $this->belongsTo(CorrespondenceContact::class, 'sender_contact_id');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(CorrespondenceRecipient::class);
    }

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(
            CorrespondenceContact::class,
            'correspondence_recipients',
            'correspondence_id',
            'contact_id'
        )->withPivot(['recipient_type', 'email_sent_at', 'email_status']);
    }

    public function owners(): HasMany
    {
        return $this->hasMany(CorrespondenceOwner::class);
    }

    public function routes(): HasMany
    {
        return $this->hasMany(CorrespondenceRoute::class)->orderByDesc('created_at');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(CorrespondenceNote::class)->orderByDesc('created_at');
    }

    public function dispatches(): HasMany
    {
        return $this->hasMany(CorrespondenceDispatch::class)->orderByDesc('dispatched_at');
    }

    public function relationshipsFrom(): HasMany
    {
        return $this->hasMany(CorrespondenceRelationship::class, 'from_correspondence_id');
    }

    public function relationshipsTo(): HasMany
    {
        return $this->hasMany(CorrespondenceRelationship::class, 'to_correspondence_id');
    }

    public function subjectFiles(): BelongsToMany
    {
        return $this->belongsToMany(
            CorrespondenceSubjectFile::class,
            'correspondence_file_links',
            'correspondence_id',
            'subject_file_id'
        )->withPivot(['is_primary'])->withTimestamps();
    }

    public function assignmentLinks(): HasMany
    {
        return $this->hasMany(CorrespondenceAssignmentLink::class);
    }

    public function referenceLedger(): HasMany
    {
        return $this->hasMany(CorrespondenceReferenceLedger::class);
    }

    public function signatureEvents(): MorphMany
    {
        return $this->morphMany(SignatureEvent::class, 'signable');
    }

    public function threadRoot(): BelongsTo
    {
        return $this->belongsTo(self::class, 'thread_root_id');
    }

    public static function generateReferenceNumber(
        string $fileCode,
        string $signatory,
        User $creator,
        int $tenantId
    ): string {
        // Legacy helper retained; prefer CorrespondenceRegisterService::allocateOutgoingReference
        $year = now()->year;
        $initials = self::extractInitials($creator->name);

        $maxSeq = static::withTrashed()
            ->where('tenant_id', $tenantId)
            ->whereYear('created_at', $year)
            ->whereNotNull('reference_number')
            ->count();

        $sequence = str_pad($maxSeq + 1, 4, '0', STR_PAD_LEFT);

        return strtoupper($fileCode) . '/' . strtoupper($signatory) . '/' . strtoupper($initials) . '/' . $sequence . '/' . $year;
    }

    public static function extractInitials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        return implode('', array_map(fn ($p) => strtoupper(substr($p, 0, 1)), $parts));
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isPendingReview(): bool { return $this->status === 'pending_review'; }
    public function isPendingApproval(): bool { return $this->status === 'pending_approval'; }
    public function isApproved(): bool { return in_array($this->status, ['approved', 'signed', 'ready_dispatch'], true); }
    public function isSent(): bool { return $this->status === 'sent'; }
    public function isOriginalImmutable(): bool { return $this->original_immutable_at !== null; }
    public function isSignedImmutable(): bool { return $this->signed_immutable_at !== null; }
    public function isVoided(): bool { return $this->voided_at !== null || $this->status === 'voided'; }

    public function canDispatch(): bool
    {
        return in_array($this->status, ['approved', 'signed', 'ready_dispatch'], true)
            && ! $this->isVoided();
    }

    public function externalPayload(): array
    {
        // Internal notes intentionally excluded
        return [
            'id' => $this->id,
            'reference_number' => $this->reference_number,
            'registry_reference' => $this->registry_reference,
            'title' => $this->title,
            'subject' => $this->subject,
            'body' => $this->body,
            'type' => $this->type,
            'language' => $this->language,
            'direction' => $this->direction,
        ];
    }
}
