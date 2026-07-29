<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class MeetingDecision extends Model
{
    use SoftDeletes;

    public const TYPES = ['resolution', 'management_decision'];

    public const STATUSES = [
        'draft',
        'adopted',
        'in_progress',
        'implemented',
        'closed',
        'superseded',
    ];

    protected $fillable = [
        'tenant_id',
        'reference_number',
        'decision_type',
        'title',
        'body',
        'status',
        'owner_id',
        'due_date',
        'meeting_minutes_id',
        'workplan_event_id',
        'agenda_item_id',
        'is_confidential',
        'created_by',
        'adopted_by',
        'adopted_at',
        'adoption_notes',
        'implemented_at',
        'closed_by',
        'closed_at',
        'closure_notes',
        'superseded_by_id',
        'source_type',
        'source_id',
        'source_purpose',
        'last_promoted_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'is_confidential' => 'boolean',
        'adopted_at' => 'datetime',
        'implemented_at' => 'datetime',
        'closed_at' => 'datetime',
        'last_promoted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $decision): void {
            if (empty($decision->reference_number)) {
                $decision->reference_number = static::nextReference((int) $decision->tenant_id);
            }
            if (empty($decision->status)) {
                $decision->status = 'draft';
            }
        });
    }

    public static function nextReference(int $tenantId): string
    {
        $year = now()->format('Y');
        $prefix = "DEC/{$year}/";

        return DB::transaction(function () use ($tenantId, $year, $prefix) {
            $latest = static::withTrashed()
                ->where('tenant_id', $tenantId)
                ->where('reference_number', 'like', $prefix.'%')
                ->lockForUpdate()
                ->orderByDesc('reference_number')
                ->value('reference_number');

            $seq = 1;
            if ($latest && preg_match('/DEC\/'.$year.'\/(\d+)$/', $latest, $m)) {
                $seq = ((int) $m[1]) + 1;
            }

            return $prefix.str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function adopter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adopted_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function minutes(): BelongsTo
    {
        return $this->belongsTo(MeetingMinutes::class, 'meeting_minutes_id');
    }

    public function agendaItem(): BelongsTo
    {
        return $this->belongsTo(MeetingAgendaItem::class, 'agenda_item_id');
    }

    public function supersededBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'superseded_by_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(MeetingDecisionAction::class, 'meeting_decision_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(MeetingDecisionHistory::class, 'meeting_decision_id');
    }

    public function openCriticalActions(): HasMany
    {
        return $this->actions()
            ->where('priority', 'critical')
            ->whereIn('status', ['open', 'in_progress']);
    }
}
