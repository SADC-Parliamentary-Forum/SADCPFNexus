<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Timesheet extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id', 'user_id', 'week_start', 'week_end',
        'total_hours', 'overtime_hours', 'status', 'rejection_reason',
        'submitted_at', 'approved_at', 'approved_by',
    ];

    protected $casts = [
        'week_start'   => 'date',
        'week_end'     => 'date',
        'submitted_at' => 'datetime',
        'approved_at'  => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function entries()
    {
        return $this->hasMany(TimesheetEntry::class);
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted';
    }
}
