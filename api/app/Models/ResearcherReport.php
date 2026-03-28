<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class ResearcherReport extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'deployment_id', 'employee_id', 'parliament_id',
        'reference_number', 'report_type', 'period_start', 'period_end', 'title', 'status',
        'executive_summary', 'activities_undertaken', 'challenges_faced',
        'recommendations', 'next_period_plan', 'srhr_indicators',
        'submitted_at', 'acknowledged_at', 'acknowledged_by', 'revision_notes',
    ];

    protected function casts(): array
    {
        return [
            'period_start'          => 'date',
            'period_end'            => 'date',
            'submitted_at'          => 'datetime',
            'acknowledged_at'       => 'datetime',
            'activities_undertaken' => 'array',
            'srhr_indicators'       => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function deployment(): BelongsTo
    {
        return $this->belongsTo(StaffDeployment::class, 'deployment_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function parliament(): BelongsTo
    {
        return $this->belongsTo(Parliament::class);
    }

    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isAcknowledged(): bool { return $this->status === 'acknowledged'; }
    public function isRevisionRequested(): bool { return $this->status === 'revision_requested'; }

    public static function generateReference(int $tenantId): string
    {
        $year = now()->year;
        $count = static::withTrashed()
            ->where('tenant_id', $tenantId)
            ->whereYear('created_at', $year)
            ->count();
        $seq = str_pad($count + 1, 3, '0', STR_PAD_LEFT);
        return "RRP-{$year}-{$seq}";
    }
}
