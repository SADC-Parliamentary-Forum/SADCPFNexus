<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class AccessReviewCampaign extends Model
{
    protected $table = 'access_review_campaigns';

    protected $fillable = [
        'tenant_id',
        'name',
        'status',
        'due_date',
        'created_by',
        'opened_at',
        'closed_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
    ];
}
