<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierDeclarationTemplate extends Model
{
    protected $fillable = [
        'tenant_id',
        'code',
        'title',
        'body',
        'version',
        'required_at_registration',
        'is_active',
    ];

    protected $casts = [
        'required_at_registration' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function acceptances(): HasMany
    {
        return $this->hasMany(SupplierDeclarationAcceptance::class, 'template_id');
    }
}
