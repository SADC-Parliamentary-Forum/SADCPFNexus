<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditGovernancePack extends Model
{
    protected $fillable = [
        'tenant_id', 'title', 'fiscal_year', 'audience', 'format', 'payload', 'generated_by',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}
