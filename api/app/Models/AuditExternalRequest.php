<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditExternalRequest extends Model
{
    protected $fillable = [
        'tenant_id', 'external_engagement_id', 'title', 'description', 'status',
        'due_date', 'created_by',
    ];

    protected $casts = ['due_date' => 'date'];
}
