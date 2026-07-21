<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MeThematicArea extends Model
{
    use HasFactory;

    protected $table = 'me_thematic_areas';

    protected $fillable = [
        'tenant_id', 'code', 'name', 'description', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];
}
