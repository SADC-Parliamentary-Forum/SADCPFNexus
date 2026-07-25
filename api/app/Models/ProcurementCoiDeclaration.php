<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementCoiDeclaration extends Model
{
    public const CONTEXT_ASSESS = 'assess';
    public const CONTEXT_AWARD  = 'award';

    protected $fillable = [
        'tenant_id',
        'procurement_request_id',
        'user_id',
        'has_conflict',
        'notes',
        'context',
    ];

    protected $casts = [
        'has_conflict' => 'boolean',
    ];

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
