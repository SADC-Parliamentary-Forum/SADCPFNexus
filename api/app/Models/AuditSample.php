<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditSample extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'method', 'population_size', 'sample_size',
        'population_description', 'rationale', 'source_table', 'source_module', 'sample_ids',
        'frozen_population', 'is_frozen', 'frozen_at', 'population_hash',
        'adjustment_justification', 'adjusted_from_sample_ids', 'adjusted_by', 'adjusted_at',
        'created_by',
    ];

    protected $casts = [
        'sample_ids' => 'array',
        'frozen_population' => 'array',
        'adjusted_from_sample_ids' => 'array',
        'is_frozen' => 'boolean',
        'frozen_at' => 'datetime',
        'adjusted_at' => 'datetime',
    ];
}
