<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class ProfileChangeRequest extends Model
{
    protected $table = 'profile_change_requests';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'user_id',
        'requested_by',
        'field_group',
        'proposed_changes',
        'requested_changes',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_notes',
        'notes',
    ];

    protected $casts = [
        'proposed_changes' => 'array',
        'requested_changes' => 'array',
        'reviewed_at' => 'datetime',
    ];
}
