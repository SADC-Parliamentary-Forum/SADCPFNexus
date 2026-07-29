<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditExternalFinding extends Model
{
    protected $fillable = [
        'tenant_id', 'external_engagement_id', 'title', 'description', 'status', 'linked_finding_id',
    ];
}
