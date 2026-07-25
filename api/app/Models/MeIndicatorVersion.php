<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeIndicatorVersion extends Model
{
    protected $fillable = [
        'tenant_id',
        'indicator_id',
        'version_number',
        'label',
        'snapshot',
        'change_notes',
        'created_by',
    ];

    protected $casts = [
        'snapshot'       => 'array',
        'version_number' => 'integer',
    ];

    public function indicator(): BelongsTo
    {
        return $this->belongsTo(Indicator::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
