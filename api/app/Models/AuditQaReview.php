<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditQaReview extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'engagement_id', 'workpaper_id', 'reviewer_id', 'review_type',
        'outcome', 'findings_summary', 'recommendations', 'reviewed_at', 'created_by',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];
}
