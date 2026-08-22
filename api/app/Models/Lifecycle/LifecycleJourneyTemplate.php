<?php

namespace App\Models\Lifecycle;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LifecycleJourneyTemplate extends Model
{
    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'lifecycle_type',
        'status',
        'created_by',
    ];

    public function versions(): HasMany
    {
        return $this->hasMany(LifecycleJourneyTemplateVersion::class, 'template_id');
    }

    public function publishedVersion(): HasOne
    {
        return $this->hasOne(LifecycleJourneyTemplateVersion::class, 'template_id')
            ->where('status', 'published')
            ->latest('version_number');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
