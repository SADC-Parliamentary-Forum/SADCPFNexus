<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class WeeklyReport extends Model
{
    use SoftDeletes;

    public const TYPE_INDIVIDUAL = 'individual';
    public const TYPE_DEPARTMENT = 'department';
    public const TYPE_INSTITUTIONAL = 'institutional';

    protected $fillable = [
        'uuid', 'tenant_id', 'reference', 'period_id', 'report_type',
        'employee_id', 'department_id', 'programme_id', 'project_id',
        'supervisor_id', 'owner_id', 'prepared_by_id', 'status', 'version',
        'confidentiality', 'declaration_confirmed', 'declaration_confirmed_at',
        'no_activity', 'additional_notes', 'work_location_status',
        'submitted_at', 'reviewed_at', 'accepted_at', 'published_at', 'employee_due_at',
    ];

    protected function casts(): array
    {
        return [
            'declaration_confirmed' => 'boolean',
            'declaration_confirmed_at' => 'datetime',
            'no_activity' => 'boolean',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'published_at' => 'datetime',
            'employee_due_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $report): void {
            if (empty($report->uuid)) {
                $report->uuid = (string) Str::uuid();
            }
        });
    }

    public function period(): BelongsTo { return $this->belongsTo(WeeklyReportingPeriod::class, 'period_id'); }
    public function employee(): BelongsTo { return $this->belongsTo(User::class, 'employee_id'); }
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function supervisor(): BelongsTo { return $this->belongsTo(User::class, 'supervisor_id'); }
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function preparedBy(): BelongsTo { return $this->belongsTo(User::class, 'prepared_by_id'); }
    public function items(): HasMany { return $this->hasMany(WeeklyReportItem::class); }
    public function blockers(): HasMany { return $this->hasMany(WeeklyReportBlocker::class); }
    public function decisionRequests(): HasMany { return $this->hasMany(WeeklyReportDecisionRequest::class); }
    public function priorities(): HasMany { return $this->hasMany(WeeklyReportPriority::class); }
    public function supportRequests(): HasMany { return $this->hasMany(WeeklyReportSupportRequest::class); }
    public function risks(): HasMany { return $this->hasMany(WeeklyReportRisk::class); }
    public function reviews(): HasMany { return $this->hasMany(WeeklyReportReview::class); }
    public function versions(): HasMany { return $this->hasMany(WeeklyReportVersion::class); }
    public function consolidationLinks(): HasMany { return $this->hasMany(WeeklyReportConsolidationLink::class, 'destination_report_id'); }
    public function suggestionDecisions(): HasMany { return $this->hasMany(WeeklyReportSuggestionDecision::class); }
    public function auditEvents(): HasMany { return $this->hasMany(WeeklyReportAuditEvent::class); }

    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'in_progress', 'ready', 'returned', 'reopened', 'not_started'], true);
    }

    public function isIndividual(): bool
    {
        return $this->report_type === self::TYPE_INDIVIDUAL;
    }
}
