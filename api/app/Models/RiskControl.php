<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class RiskControl extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'control_code', 'title', 'description', 'control_type',
        'control_owner_id', 'effectiveness', 'status', 'frequency', 'created_by',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $control): void {
            if (empty($control->control_code)) {
                $control->control_code = 'CTL-'.strtoupper(Str::random(8));
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'control_owner_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function risks(): BelongsToMany
    {
        return $this->belongsToMany(Risk::class, 'risk_control_risk', 'control_id', 'risk_id')
            ->withPivot('effectiveness_rating', 'notes', 'linked_by', 'created_at');
    }
}
