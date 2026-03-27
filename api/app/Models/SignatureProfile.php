<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SignatureProfile extends Model
{
    protected $fillable = ['tenant_id', 'user_id', 'type', 'status'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(SignatureVersion::class, 'profile_id');
    }

    public function activeVersion(): HasOne
    {
        return $this->hasOne(SignatureVersion::class, 'profile_id')
            ->whereNull('revoked_at')
            ->orderByDesc('version_no');
    }

    public static function activeForUser(int $userId, string $type = 'full'): ?static
    {
        return static::where('user_id', $userId)
            ->where('type', $type)
            ->where('status', 'active')
            ->first();
    }
}
