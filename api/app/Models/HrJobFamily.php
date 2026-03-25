<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrJobFamily extends Model
{
    use SoftDeletes;

    protected $table = 'hr_job_families';

    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'description',
        'color',
        'icon',
        'status',
    ];

    public function gradeBands(): HasMany
    {
        return $this->hasMany(HrGradeBand::class, 'job_family_id');
    }
}
