<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLookup extends Model
{
    protected $fillable = [
        'tenant_id', 'category', 'code', 'label', 'sort_order', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];
}
