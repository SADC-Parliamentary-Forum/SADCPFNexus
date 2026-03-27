<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Correspondence extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'correspondence';

    protected $fillable = [
        'tenant_id', 'created_by', 'reviewed_by', 'approved_by',
        'reference_number', 'title', 'subject', 'body',
        'type', 'priority', 'language', 'status', 'direction',
        'file_code', 'signatory_code', 'department_id', 'programme_id',
        'file_path', 'original_filename', 'mime_type', 'size_bytes',
        'review_comment', 'rejection_reason',
        'submitted_at', 'reviewed_at', 'approved_at', 'sent_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'reviewed_at'  => 'datetime',
        'approved_at'  => 'datetime',
        'sent_at'      => 'datetime',
        'size_bytes'   => 'integer',
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

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
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

    public static function generateReferenceNumber(
        string $fileCode,
        string $signatory,
        User $creator,
        int $tenantId
    ): string {
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

    private static function extractInitials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));
        return implode('', array_map(fn ($p) => strtoupper(substr($p, 0, 1)), $parts));
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isPendingReview(): bool { return $this->status === 'pending_review'; }
    public function isPendingApproval(): bool { return $this->status === 'pending_approval'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
    public function isSent(): bool { return $this->status === 'sent'; }
}
