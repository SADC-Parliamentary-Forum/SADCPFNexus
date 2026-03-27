<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SignatureVersion extends Model
{
    protected $fillable = ['profile_id', 'file_path', 'hash', 'version_no', 'effective_from', 'revoked_at'];

    protected $casts = [
        'effective_from' => 'datetime',
        'revoked_at'     => 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SignatureProfile::class, 'profile_id');
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null;
    }
}
