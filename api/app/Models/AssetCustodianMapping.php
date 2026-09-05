<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetCustodianMapping extends Model
{
    protected $fillable = [
        'tenant_id', 'import_batch_id', 'legacy_key', 'custodian_type',
        'user_id', 'department_id', 'location_id', 'confidence', 'confirmed',
        'confirmed_by', 'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'confirmed' => 'boolean',
            'confidence' => 'decimal:2',
            'confirmed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
