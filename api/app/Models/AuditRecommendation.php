<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditRecommendation extends Model
{
    protected $fillable = [
        'tenant_id', 'finding_id', 'recommendation_text', 'status', 'created_by',
    ];
}
