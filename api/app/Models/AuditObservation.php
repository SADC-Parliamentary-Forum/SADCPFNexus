<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditObservation extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'title', 'description', 'status',
        'converted_finding_id', 'created_by', 'confidentiality_level',
    ];
}
