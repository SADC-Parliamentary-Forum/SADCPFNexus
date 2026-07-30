<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Position extends Model
{
    protected $fillable = [
        'tenant_id',
        'department_id',
        'organisational_unit_id',
        'title',
        'code',
        'grade',
        'grade_band_id',
        'description',
        'headcount',
        'is_active',
        'status',
        'reports_to_position_id',
        'effective_from',
        'effective_to',
        'is_sg_role',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_sg_role' => 'boolean',
        'headcount' => 'integer',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function gradeBand(): BelongsTo
    {
        return $this->belongsTo(HrGradeBand::class, 'grade_band_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
