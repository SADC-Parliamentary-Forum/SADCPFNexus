<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetNumberingPolicy extends Model
{
    protected $fillable = [
        'tenant_id', 'prefix', 'separator', 'sequence_length',
        'include_category', 'include_subcategory', 'auto_assign', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'include_category' => 'boolean',
            'include_subcategory' => 'boolean',
            'auto_assign' => 'boolean',
            'sequence_length' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
