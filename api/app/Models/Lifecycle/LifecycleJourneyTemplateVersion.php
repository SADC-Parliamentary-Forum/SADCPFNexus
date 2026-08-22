<?php

namespace App\Models\Lifecycle;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LifecycleJourneyTemplateVersion extends Model
{
    protected $fillable = [
        'tenant_id',
        'template_id',
        'version_number',
        'status',
        'definition',
        'published_at',
        'published_by',
        'created_by',
    ];

    protected $casts = [
        'definition' => 'array',
        'published_at' => 'datetime',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(LifecycleJourneyTemplate::class, 'template_id');
    }

    public function cases(): HasMany
    {
        return $this->hasMany(LifecycleCase::class, 'template_version_id');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
