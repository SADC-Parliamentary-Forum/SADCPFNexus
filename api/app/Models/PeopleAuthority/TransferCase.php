<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class TransferCase extends Model
{
    protected $table = 'transfer_cases';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'from_position_id',
        'to_position_id',
        'from_unit_id',
        'to_unit_id',
        'transfer_type',
        'status',
        'effective_date',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'effective_date' => 'date',
    ];
}
