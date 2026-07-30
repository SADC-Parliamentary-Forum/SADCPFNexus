<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeopleEsignRequest extends Model
{
    protected $table = 'people_esign_requests';

    protected $fillable = [
        'tenant_id',
        'document_type',
        'document_id',
        'document_version_id',
        'document_hash',
        'provider',
        'external_id',
        'status',
        'recipients',
        'provider_payload',
        'provider_response',
        'requested_by',
        'submitted_at',
        'completed_at',
        'notes',
    ];

    protected $casts = [
        'recipients' => 'array',
        'provider_payload' => 'array',
        'provider_response' => 'array',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
}
