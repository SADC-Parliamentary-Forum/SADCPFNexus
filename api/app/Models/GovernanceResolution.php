<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class GovernanceResolution extends Model
{
    protected $fillable = [
        'tenant_id', 'reference_number', 'title', 'description', 'status', 'adopted_at',
        'type', 'committee', 'lead_member', 'lead_role',
    ];

    protected function casts(): array
    {
        return ['adopted_at' => 'date'];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->orderBy('language');
    }
}
