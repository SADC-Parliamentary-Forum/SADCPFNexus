<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkAssignmentUpdate extends Model
{
    protected $fillable = [
        'tenant_id', 'assignment_id', 'user_id', 'update_type',
        'content', 'hours_logged', 'new_status',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(WorkAssignment::class, 'assignment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
