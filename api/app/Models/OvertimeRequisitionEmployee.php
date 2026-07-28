<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimeRequisitionEmployee extends Model
{
    protected $fillable = [
        'overtime_requisition_id', 'user_id', 'planned_hours',
    ];

    protected $casts = [
        'planned_hours' => 'decimal:2',
    ];

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(OvertimeRequisition::class, 'overtime_requisition_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
