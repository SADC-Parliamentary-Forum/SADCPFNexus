<?php

namespace App\Models\PeopleAuthority;

use App\Models\Position;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PositionAssignment extends Model
{
    protected $table = 'position_assignments';

    protected $fillable = [
        'tenant_id',
        'position_id',
        'person_id',
        'assignment_type',
        'is_substantive',
        'start_at',
        'end_at',
        'appointment_document_id',
        'approved_by',
        'status',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'is_substantive' => 'boolean',
        'start_at' => 'date',
        'end_at' => 'date',
    ];

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class, 'position_id');
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }
}
