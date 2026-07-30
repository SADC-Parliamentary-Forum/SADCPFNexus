<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeopleAiSuggestion extends Model
{
    protected $table = 'people_ai_suggestions';

    protected $fillable = [
        'tenant_id',
        'kind',
        'provider',
        'status',
        'auto_applied',
        'input_context',
        'suggestion',
        'applied_action',
        'apply_note',
        'created_by',
        'applied_by',
        'applied_at',
    ];

    protected $casts = [
        'auto_applied' => 'boolean',
        'input_context' => 'array',
        'suggestion' => 'array',
        'applied_at' => 'datetime',
    ];
}
