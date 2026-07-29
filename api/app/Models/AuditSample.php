<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditSample extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'method', 'population_size', 'sample_size',
        'population_description', 'rationale', 'source_table', 'sample_ids', 'created_by',
    ];

    protected $casts = ['sample_ids' => 'array'];
}
