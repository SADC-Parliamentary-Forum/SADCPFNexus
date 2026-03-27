<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SignedDocument extends Model
{
    protected $fillable = [
        'tenant_id',
        'signable_type',
        'signable_id',
        'version',
        'file_path',
        'hash',
        'finalized_at',
    ];

    protected $casts = [
        'finalized_at' => 'datetime',
    ];

    public function signable(): MorphTo
    {
        return $this->morphTo();
    }
}
