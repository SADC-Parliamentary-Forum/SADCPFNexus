<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BudgetReservation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'procurement_request_id', 'reserved_by',
        'budget_line', 'reserved_amount', 'currency', 'notes',
        'released_at', 'released_by',
    ];

    protected $casts = [
        'reserved_amount' => 'float',
        'released_at'     => 'datetime',
    ];

    public function procurementRequest() { return $this->belongsTo(ProcurementRequest::class); }
    public function reservedBy()         { return $this->belongsTo(User::class, 'reserved_by'); }
    public function releasedBy()         { return $this->belongsTo(User::class, 'released_by'); }

    public function isReleased(): bool
    {
        return $this->released_at !== null;
    }
}
