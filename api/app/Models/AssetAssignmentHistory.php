<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAssignmentHistory extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'assigned_to', 'department', 'assignment_type',
        'assigned_at', 'returned_at', 'acknowledged_at', 'assigned_by', 'notes',
        'declined_at', 'decline_reason', 'return_requested_at', 'return_requested_by',
        'condition_at_return',
        'custodian_type', 'custodian_department_id', 'custodian_location_id',
        'handover_id', 'handover_line_id', 'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'returned_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'declined_at' => 'datetime',
            'return_requested_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function custodianLocation(): BelongsTo
    {
        return $this->belongsTo(AssetLocation::class, 'custodian_location_id');
    }

    public function handover(): BelongsTo
    {
        return $this->belongsTo(AssetHandover::class, 'handover_id');
    }
}
