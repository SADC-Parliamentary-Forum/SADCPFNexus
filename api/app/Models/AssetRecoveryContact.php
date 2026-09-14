<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetRecoveryContact extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_category_id', 'name', 'department', 'primary_phone',
        'secondary_phone', 'whatsapp', 'email', 'return_address', 'office_hours',
        'instructions', 'show_primary_phone', 'show_secondary_phone', 'show_whatsapp',
        'show_email', 'show_address', 'version', 'effective_from', 'active',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'show_primary_phone' => 'boolean',
            'show_secondary_phone' => 'boolean',
            'show_whatsapp' => 'boolean',
            'show_email' => 'boolean',
            'show_address' => 'boolean',
            'active' => 'boolean',
            'effective_from' => 'datetime',
            'version' => 'integer',
        ];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(AssetRecoveryContactVersion::class, 'recovery_contact_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'asset_category_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function publicPayload(): array
    {
        $contact = [];
        if ($this->show_primary_phone && $this->primary_phone) {
            $contact['telephone'] = $this->primary_phone;
        }
        if ($this->show_secondary_phone && $this->secondary_phone) {
            $contact['alternateTelephone'] = $this->secondary_phone;
        }
        if ($this->show_whatsapp && $this->whatsapp) {
            $contact['whatsapp'] = $this->whatsapp;
        }
        if ($this->show_email && $this->email) {
            $contact['email'] = $this->email;
        }
        if ($this->show_address && $this->return_address) {
            $contact['address'] = $this->return_address;
        }
        if ($this->instructions) {
            $contact['instructions'] = $this->instructions;
        }
        if ($this->name) {
            $contact['name'] = $this->name;
        }
        if ($this->department) {
            $contact['department'] = $this->department;
        }

        return $contact;
    }
}
