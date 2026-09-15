<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetRecoveryContactVersion extends Model
{
    protected $fillable = [
        'tenant_id', 'recovery_contact_id', 'version', 'effective_from',
        'snapshot', 'reason', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'effective_from' => 'datetime',
            'version' => 'integer',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(AssetRecoveryContact::class, 'recovery_contact_id');
    }
}
