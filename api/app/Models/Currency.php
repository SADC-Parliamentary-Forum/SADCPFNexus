<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Currency extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'name', 'symbol', 'is_active', 'is_default', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'sort_order' => 'integer',
    ];
}
