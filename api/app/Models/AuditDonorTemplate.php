<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditDonorTemplate extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'name', 'donor_name', 'applies_to', 'sections',
        'guidance', 'is_active', 'created_by',
    ];

    protected $casts = [
        'sections' => 'array',
        'is_active' => 'boolean',
    ];
}
