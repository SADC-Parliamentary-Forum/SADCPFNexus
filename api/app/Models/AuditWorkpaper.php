<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

class AuditWorkpaper extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'reference', 'title', 'content', 'status',
        'prepared_by', 'reviewed_by', 'reviewed_at', 'is_immutable', 'confidentiality_level',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'is_immutable' => 'boolean',
    ];

    public function reviewNotes(): HasMany
    {
        return $this->hasMany(AuditWorkpaperReviewNote::class, 'workpaper_id');
    }

    public function assertEditable(): void
    {
        if ($this->is_immutable || $this->status === 'final') {
            throw ValidationException::withMessages([
                'workpaper' => 'Final workpapers are immutable.',
            ]);
        }
    }
}
