<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMovement extends Model
{
    protected $fillable = [
        'tenant_id',
        'asset_id',
        'from_user_id',
        'to_user_id',
        'recorded_by',
        'movement_type',
        'reason',
        'notes',
        'movement_date',
        'from_location_id',
        'to_location_id',
        'from_department_id',
        'to_department_id',
        'approved_by',
        'requested_by',
        'reference_document',
        'effective_date',
    ];

    protected $casts = [
        'movement_date' => 'date',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
