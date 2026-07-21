<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MeEvidence extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'me_evidence';

    public const TYPES = ['attendance', 'photo', 'report', 'publication', 'media', 'financial', 'other'];
    public const REVIEW_PENDING   = 'pending';
    public const REVIEW_VALIDATED = 'validated';
    public const REVIEW_REJECTED  = 'rejected';

    protected $fillable = [
        'tenant_id', 'me_activity_report_id', 'programme_id', 'indicator_id',
        'title', 'evidence_type', 'review_status', 'version', 'review_notes',
        'uploaded_by', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'version'     => 'integer',
        'reviewed_at' => 'datetime',
    ];

    public function activityReport(): BelongsTo
    {
        return $this->belongsTo(MeActivityReport::class, 'me_activity_report_id');
    }

    public function programme(): BelongsTo
    {
        return $this->belongsTo(Programme::class, 'programme_id');
    }

    public function indicator(): BelongsTo
    {
        return $this->belongsTo(Indicator::class, 'indicator_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** The actual file(s) are stored as polymorphic Attachments on this record. */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
