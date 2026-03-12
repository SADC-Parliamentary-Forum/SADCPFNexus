<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AppraisalCycle extends Model
{
    protected $fillable = [
        'tenant_id', 'created_by', 'title', 'description',
        'period_start', 'period_end', 'submission_deadline', 'status',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'submission_deadline' => 'date',
        ];
    }

    public function appraisals(): HasMany
    {
        return $this->hasMany(Appraisal::class, 'cycle_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
