<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class RiskAction extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id', 'risk_id', 'created_by', 'owner_id',
        'description', 'action_plan', 'treatment_type',
        'due_date', 'status', 'progress', 'notes', 'completed_at',
    ];

    protected $casts = [
        'due_date'     => 'date',
        'completed_at' => 'datetime',
        'progress'     => 'integer',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function risk()    { return $this->belongsTo(Risk::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function owner()   { return $this->belongsTo(User::class, 'owner_id'); }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isOverdue(): bool
    {
        return $this->due_date !== null
            && $this->due_date->isPast()
            && $this->status !== 'completed';
    }
}
