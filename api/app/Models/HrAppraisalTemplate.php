<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class HrAppraisalTemplate extends Model
{
    use SoftDeletes;

    protected $table = 'hr_appraisal_templates';

    protected $fillable = [
        'tenant_id',
        'name',
        'description',
        'cycle_frequency',
        'rating_scale_max',
        'kra_count_default',
        'is_probation_template',
        'is_active',
    ];

    protected $casts = [
        'rating_scale_max'      => 'integer',
        'kra_count_default'     => 'integer',
        'is_probation_template' => 'boolean',
        'is_active'             => 'boolean',
    ];

    public function gradeBands(): HasMany
    {
        return $this->hasMany(HrGradeBand::class, 'appraisal_template_id');
    }
}
