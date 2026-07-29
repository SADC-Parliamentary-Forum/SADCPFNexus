<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentDependency extends Model
{
    protected $fillable = [
        'tenant_id',
        'assignment_id',
        'depends_on_assignment_id',
        'dependency_type',
        'notes',
        'created_by',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'assignment_id');
    }

    public function dependsOn(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'depends_on_assignment_id');
    }
}
