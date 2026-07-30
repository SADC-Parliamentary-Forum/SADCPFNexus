<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class AccessReviewItem extends Model
{
    protected $table = 'access_review_items';

    protected $fillable = [
        'tenant_id',
        'campaign_id',
        'user_id',
        'person_id',
        'review_type',
        'subject_snapshot',
        'decision',
        'reviewed_by',
        'reviewed_at',
        'status',
    ];

    protected $casts = [
        'subject_snapshot' => 'array',
        'reviewed_at' => 'datetime',
    ];
}
