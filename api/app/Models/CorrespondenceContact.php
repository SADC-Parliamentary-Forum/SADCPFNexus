<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CorrespondenceContact extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id', 'full_name', 'organization', 'country',
        'email', 'phone', 'stakeholder_type', 'tags',
    ];

    protected $casts = [
        'tags' => 'array',
    ];

    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(
            ContactGroup::class,
            'contact_group_members',
            'contact_id',
            'group_id'
        );
    }
}
