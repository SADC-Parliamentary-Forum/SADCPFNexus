<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PersonUserLink extends Model
{
    protected $table = 'person_user_links';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'user_id',
        'link_type',
        'status',
        'linked_at',
        'unlinked_at',
        'linked_by',
    ];

    protected $casts = [
        'linked_at' => 'datetime',
        'unlinked_at' => 'datetime',
    ];
}
