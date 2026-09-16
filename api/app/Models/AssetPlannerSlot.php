<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetPlannerSlot extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'to_user_id', 'handover_id', 'notes', 'created_by',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function handover(): BelongsTo
    {
        return $this->belongsTo(AssetHandover::class, 'handover_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
