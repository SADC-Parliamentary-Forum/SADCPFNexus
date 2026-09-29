<?php

namespace App\Models\PeopleAuthority;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
