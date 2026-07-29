<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class RiskControlTestingCampaign extends Model
{
    use SoftDeletes;

    public const STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'];

    protected $fillable = [
        'tenant_id', 'campaign_code', 'title', 'description', 'status',
        'scheduled_start', 'scheduled_end', 'owner_id', 'created_by', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_start' => 'date',
            'scheduled_end' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $campaign): void {
            if (empty($campaign->campaign_code)) {
                $campaign->campaign_code = 'CTC-'.strtoupper(Str::random(8));
            }
            if (empty($campaign->status)) {
                $campaign->status = 'draft';
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(RiskControlTestingItem::class, 'campaign_id');
    }
}
