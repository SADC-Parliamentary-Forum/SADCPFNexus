<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeSetting extends Model
{
    protected $fillable = [
        'tenant_id',
        'auto_intake',
        'report_due_days',
        'programme_manager_review',
    ];

    protected $casts = [
        'auto_intake'              => 'boolean',
        'report_due_days'           => 'integer',
        'programme_manager_review'  => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
