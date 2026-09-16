<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetEquipmentTemplate extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'role_name', 'required_categories', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'required_categories' => 'array',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
