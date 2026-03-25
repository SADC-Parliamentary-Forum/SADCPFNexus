<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrGradeBand extends Model
{
    use SoftDeletes;

    protected $table = 'hr_grade_bands';

    protected $fillable = [
        'tenant_id',
        'code',
        'label',
        'band_group',
        'employment_category',
        'min_notch',
        'max_notch',
        'probation_months',
        'notice_period_days',
        'leave_days_per_year',
        'overtime_eligible',
        'acting_allowance_rate',
        'travel_class',
        'medical_aid_eligible',
        'housing_allowance_eligible',
        'job_family_id',
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
        'overtime_eligible'         => 'boolean',
        'medical_aid_eligible'      => 'boolean',
        'housing_allowance_eligible'=> 'boolean',
        'acting_allowance_rate'     => 'decimal:4',
        'leave_days_per_year'       => 'decimal:1',
        'effective_from'            => 'date',
        'effective_to'              => 'date',
        'reviewed_at'               => 'datetime',
        'approved_at'               => 'datetime',
        'published_at'              => 'datetime',
        'min_notch'                 => 'integer',
        'max_notch'                 => 'integer',
        'probation_months'          => 'integer',
        'notice_period_days'        => 'integer',
        'version_number'            => 'integer',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    public function jobFamily(): BelongsTo
    {
        return $this->belongsTo(HrJobFamily::class, 'job_family_id');
    }

    public function salaryScales(): HasMany
    {
        return $this->hasMany(HrSalaryScale::class, 'grade_band_id');
    }

    public function positions(): HasMany
    {
        return $this->hasMany(Position::class, 'grade_band_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    // ── Scopes ─────────────────────────────────────────────────────────────────

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Returns true if any active staff or positions reference this grade band.
     * Used by delete guard and impact check.
     */
    public function hasActiveStaff(): bool
    {
        if ($this->positions()->whereHas('users')->exists()) {
            return true;
        }

        // Also check hr_personal_files using the grade code string (denormalised)
        return HrPersonalFile::where('tenant_id', $this->tenant_id)
            ->where('grade_scale', $this->code)
            ->exists();
    }

    public function activeStaffCount(): int
    {
        $positionUsers = $this->positions()
            ->withCount('users')
            ->get()
            ->sum('users_count');

        $fileCount = HrPersonalFile::where('tenant_id', $this->tenant_id)
            ->where('grade_scale', $this->code)
            ->count();

        return $positionUsers + $fileCount;
    }
}
