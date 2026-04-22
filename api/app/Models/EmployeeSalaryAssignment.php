<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;

class EmployeeSalaryAssignment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'grade_band_id',
        'salary_scale_id',
        'notch_number',
        'effective_from',
        'effective_to',
        'employment_type',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to'   => 'date',
            'notch_number'   => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function gradeBand(): BelongsTo
    {
        return $this->belongsTo(HrGradeBand::class, 'grade_band_id');
    }

    public function salaryScale(): BelongsTo
    {
        return $this->belongsTo(HrSalaryScale::class, 'salary_scale_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isActive(): bool
    {
        $today = Carbon::today();
        return $this->effective_from->lte($today)
            && ($this->effective_to === null || $this->effective_to->gte($today));
    }
}
