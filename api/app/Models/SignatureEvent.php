<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SignatureEvent extends Model
{
    public const UPDATED_AT = null; // Events are immutable

    protected $fillable = [
        'tenant_id',
        'signable_type',
        'signable_id',
        'step_key',
        'signer_user_id',
        'signature_version_id',
        'action',
        'comment',
        'auth_level',
        'ip_address',
        'user_agent',
        'document_hash',
        'is_delegated',
        'delegated_authority_id',
        'signed_at',
    ];

    protected $casts = [
        'signed_at'    => 'datetime',
        'is_delegated' => 'boolean',
    ];

    public function signable(): MorphTo
    {
        return $this->morphTo();
    }

    public function signer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signer_user_id');
    }

    public function signatureVersion(): BelongsTo
    {
        return $this->belongsTo(SignatureVersion::class, 'signature_version_id');
    }

    public function delegatedAuthority(): BelongsTo
    {
        return $this->belongsTo(DelegatedAuthority::class, 'delegated_authority_id');
    }
}
