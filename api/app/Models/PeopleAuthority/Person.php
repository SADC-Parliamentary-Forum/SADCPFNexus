<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Person extends Model
{
    use SoftDeletes;

    protected $table = 'people';

    protected $fillable = [
        'tenant_id',
        'person_number',
        'title',
        'first_name',
        'middle_name',
        'last_name',
        'preferred_name',
        'display_name',
        'person_type',
        'employment_status',
        'work_email',
        'work_phone',
        'mobile_phone',
        'office_location',
        'primary_unit_id',
        'start_date',
        'end_date',
        'directory_visible',
        'photo_path',
        'directory_meta',
        'operational_meta',
        'created_by',
    ];

    protected $casts = [
        'directory_visible' => 'boolean',
        'start_date' => 'date',
        'end_date' => 'date',
        'directory_meta' => 'array',
        'operational_meta' => 'array',
    ];

    public function organisationalUnit(): BelongsTo
    {
        return $this->belongsTo(OrganisationalUnit::class, 'primary_unit_id');
    }

    public function employmentRecord(): HasOne
    {
        return $this->hasOne(EmploymentRecord::class, 'person_id')->latestOfMany();
    }

    public function activePositionAssignment(): HasOne
    {
        return $this->hasOne(PositionAssignment::class, 'person_id')
            ->where('status', 'active')
            ->latestOfMany('start_at');
    }
}
