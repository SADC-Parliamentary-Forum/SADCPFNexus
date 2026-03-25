<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrSalaryScale extends Model
{
    use SoftDeletes;

    protected $table = 'hr_salary_scales';

    protected $fillable = [
        'tenant_id',
        'grade_band_id',
        'currency',
        'notches',
        'status',
        'effective_from',
        'effective_to',
        'version_number',
        'created_by',
        'reviewed_by',
        'approved_by',
        'published_by',
        'reviewed_at',
        'approved_at',
        'published_at',
        'notes',
    ];

    protected $casts = [
        'notches'        => 'array',
        'effective_from' => 'date',
        'effective_to'   => 'date',
        'reviewed_at'    => 'datetime',
        'approved_at'    => 'datetime',
        'published_at'   => 'datetime',
        'version_number' => 'integer',
    ];

    public function gradeBand(): BelongsTo
    {
        return $this->belongsTo(HrGradeBand::class, 'grade_band_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }
}
