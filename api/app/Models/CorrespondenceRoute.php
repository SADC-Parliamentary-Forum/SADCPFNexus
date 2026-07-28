<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceRoute extends Model
{
    protected $table = 'correspondence_routes';

    protected $fillable = [
        'correspondence_id', 'routed_by', 'action', 'primary_owner_id', 'department_id',
        'instruction', 'priority', 'due_date', 'response_required', 'response_due_date',
        'copy_to_user_ids', 'supporting_owner_ids',
    ];

    protected $casts = [
        'due_date' => 'date',
        'response_due_date' => 'date',
        'response_required' => 'boolean',
        'copy_to_user_ids' => 'array',
        'supporting_owner_ids' => 'array',
    ];

    public function correspondence(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class);
    }

    public function router(): BelongsTo
    {
        return $this->belongsTo(User::class, 'routed_by');
    }

    public function primaryOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'primary_owner_id');
    }
}
