<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditControlTestingCampaign extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'title', 'risk_campaign_id', 'engagement_id', 'universe_entity_id',
        'scheduled_start', 'scheduled_end', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'scheduled_start' => 'date',
        'scheduled_end' => 'date',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(AuditControlTestingItem::class, 'campaign_id');
    }
}
