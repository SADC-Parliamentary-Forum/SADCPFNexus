<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ContactGroup extends Model
{
    use HasFactory;

    protected $fillable = ['tenant_id', 'name', 'description'];

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(
            CorrespondenceContact::class,
            'contact_group_members',
            'group_id',
            'contact_id'
        );
    }
}
