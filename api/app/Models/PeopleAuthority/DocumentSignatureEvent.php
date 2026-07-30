<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class DocumentSignatureEvent extends Model
{
    protected $table = 'document_signature_events';

    protected $fillable = [
        'tenant_id',
        'document_type',
        'document_id',
        'document_version_id',
        'document_hash',
        'signer_person_id',
        'signer_account_id',
        'position_snapshot',
        'department_snapshot',
        'signature_meaning',
        'authority_assignment_id',
        'authority_snapshot_id',
        'delegation_id',
        'acting_appointment_id',
        'signature_enrolment_id',
        'authentication_strength',
        'signature_method',
        'verification_reference',
        'status',
        'is_immutable',
        'signed_at',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'position_snapshot' => 'array',
        'department_snapshot' => 'array',
        'is_immutable' => 'boolean',
        'signed_at' => 'datetime',
    ];
}
