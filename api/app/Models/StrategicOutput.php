<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StrategicOutput extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'strategic_outcome_id', 'code', 'title', 'description', 'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function outcome(): BelongsTo
    {
        return $this->belongsTo(StrategicOutcome::class, 'strategic_outcome_id');
    }
}
