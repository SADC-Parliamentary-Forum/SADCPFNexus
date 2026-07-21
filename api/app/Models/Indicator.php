<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Indicator extends Model
{
    use HasFactory, SoftDeletes;

    public const RESULT_LEVELS = ['impact', 'outcome', 'output', 'activity'];
    public const FREQUENCIES   = ['monthly', 'quarterly', 'bi_annual', 'annual'];

    protected $fillable = [
        'tenant_id', 'results_framework_id', 'strategic_objective_id', 'strategic_output_id',
        'programme_id', 'code', 'name', 'result_level', 'unit',
        'baseline_value', 'baseline_year', 'annual_target', 'cumulative_target',
        'disaggregation', 'data_source', 'evidence_required', 'frequency',
        'responsible_person_id', 'is_active', 'description', 'created_by',
    ];

    protected $casts = [
        'disaggregation'    => 'array',
        'evidence_required' => 'boolean',
        'is_active'         => 'boolean',
        'baseline_value'    => 'decimal:2',
        'annual_target'     => 'decimal:2',
        'cumulative_target' => 'decimal:2',
    ];

    public function framework(): BelongsTo
    {
        return $this->belongsTo(ResultsFramework::class, 'results_framework_id');
    }

    public function objective(): BelongsTo
    {
        return $this->belongsTo(StrategicObjective::class, 'strategic_objective_id');
    }

    public function output(): BelongsTo
    {
        return $this->belongsTo(StrategicOutput::class, 'strategic_output_id');
    }

    public function programme(): BelongsTo
    {
        return $this->belongsTo(Programme::class, 'programme_id');
    }

    public function responsiblePerson(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_person_id');
    }
}
