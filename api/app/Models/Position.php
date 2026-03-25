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
        'title',
        'grade',
        'grade_band_id',
        'description',
        'headcount',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'headcount' => 'integer',
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
