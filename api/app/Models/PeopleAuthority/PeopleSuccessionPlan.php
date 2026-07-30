<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PeopleSuccessionPlan extends Model
{
    use SoftDeletes;

    protected $table = 'people_succession_plans';

    protected $fillable = [
        'tenant_id',
        'position_id',
        'title',
        'status',
        'notes',
        'created_by',
    ];

    public function candidates(): HasMany
    {
        return $this->hasMany(PeopleSuccessionCandidate::class, 'succession_plan_id');
    }
}
