<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Tender extends Model
{
    use SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PUBLISHED = 'published';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_OPENED = 'opened';
    public const STATUS_EVALUATING = 'evaluating';
    public const STATUS_AWARDED = 'awarded';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id', 'procurement_request_id', 'tender_committee_id',
        'reference_number', 'title', 'notice', 'status', 'sealed_mode',
        'published_at', 'submission_deadline', 'closed_at',
        'bids_opened_at', 'bids_opened_by', 'evaluation_started_at',
        'technical_weight', 'financial_weight', 'min_technical_score', 'created_by',
        'newspaper_checklist',
    ];

    protected $casts = [
        'sealed_mode'           => 'boolean',
        'published_at'          => 'datetime',
        'submission_deadline'   => 'date',
        'closed_at'             => 'datetime',
        'bids_opened_at'        => 'datetime',
        'evaluation_started_at' => 'datetime',
        'technical_weight'      => 'float',
        'financial_weight'      => 'float',
        'min_technical_score'   => 'float',
        'newspaper_checklist'   => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $tender): void {
            if (empty($tender->reference_number)) {
                $tender->reference_number = 'TND-' . strtoupper(Str::random(8));
            }
        });
    }

    public function procurementRequest()
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function committee()
    {
        return $this->belongsTo(TenderCommittee::class, 'tender_committee_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function openedBy()
    {
        return $this->belongsTo(User::class, 'bids_opened_by');
    }

    public function isSealed(): bool
    {
        return $this->sealed_mode && blank($this->bids_opened_at);
    }

    public function isPastDeadline(): bool
    {
        if (!$this->submission_deadline) {
            return false;
        }

        return now()->isAfter($this->submission_deadline->endOfDay());
    }
}
