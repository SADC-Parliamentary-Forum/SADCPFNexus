<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class AccessReviewCampaign extends Model
{
    protected $table = 'access_review_campaigns';

    protected $fillable = [
        'tenant_id',
        'name',
        'campaign_type',
        'recurrence',
        'auto_populate_roles',
        'status',
        'due_date',
        'created_by',
        'opened_at',
        'closed_at',
        'last_auto_opened_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'auto_populate_roles' => 'boolean',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'last_auto_opened_at' => 'datetime',
    ];
}
