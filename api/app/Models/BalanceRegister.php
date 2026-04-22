<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BalanceRegister extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'module_type', 'employee_id',
        'source_request_type', 'source_request_id',
        'reference_number', 'approved_amount', 'total_processed',
        'balance', 'installment_amount', 'recovery_start_date',
        'estimated_payoff_date', 'status', 'period_locked_at',
        'locked_by', 'created_by',
    ];

    protected $casts = [
        'approved_amount'      => 'decimal:2',
        'total_processed'      => 'decimal:2',
        'balance'              => 'decimal:2',
        'installment_amount'   => 'decimal:2',
        'recovery_start_date'  => 'date',
        'estimated_payoff_date'=> 'date',
        'period_locked_at'     => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lockedBy()
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    public function transactions()
    {
        return $this->hasMany(BalanceTransaction::class, 'register_id')->orderByDesc('created_at');
    }

    public function acknowledgements()
    {
        return $this->hasMany(BalanceAcknowledgement::class, 'register_id')->orderByDesc('created_at');
    }

    public function sourceRequest()
    {
        return $this->morphTo('source_request', 'source_request_type', 'source_request_id');
    }

    public function isActive(): bool   { return $this->status === 'active'; }
    public function isLocked(): bool   { return $this->status === 'locked'; }
    public function isDisputed(): bool { return $this->status === 'disputed'; }
    public function isClosed(): bool   { return $this->status === 'closed'; }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeModule($query, string $type)
    {
        return $query->where('module_type', $type);
    }
}
