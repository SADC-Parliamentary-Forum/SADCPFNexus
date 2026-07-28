<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TimesheetPeriod extends Model
{
    public const OPEN = 'open';
    public const CLOSING = 'closing';
    public const CLOSED = 'closed';
    public const PAYROLL_EXPORTED = 'payroll_exported';

    protected $fillable = [
        'tenant_id', 'period_start', 'period_end', 'label',
        'status', 'closed_at', 'closed_by',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'closed_at' => 'datetime',
    ];

    public function isEditable(): bool
    {
        return $this->status === self::OPEN;
    }

    public function timesheets(): HasMany
    {
        return $this->hasMany(Timesheet::class, 'period_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
