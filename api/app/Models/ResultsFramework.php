<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ResultsFramework extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'results_frameworks';

    public const TYPES = ['sadc_pf', 'srhr', 'giz', 'donor', 'institutional'];

    protected $fillable = [
        'tenant_id', 'name', 'type', 'donor_name', 'description',
        'strategic_plan_id', 'strategic_goal_id',
        'start_date', 'end_date', 'status', 'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date'   => 'date',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(StrategicPlan::class, 'strategic_plan_id');
    }

    public function goal(): BelongsTo
    {
        return $this->belongsTo(StrategicGoal::class, 'strategic_goal_id');
    }

    public function indicators(): HasMany
    {
        return $this->hasMany(Indicator::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
