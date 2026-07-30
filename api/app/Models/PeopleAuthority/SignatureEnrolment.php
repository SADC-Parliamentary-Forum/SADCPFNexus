<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class SignatureEnrolment extends Model
{
    protected $table = 'signature_enrolments';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'user_id',
        'signature_profile_id',
        'enrolment_type',
        'status',
        'specimen_path',
        'specimen_hash',
        'certificate_subject',
        'certificate_thumbprint',
        'certificate_expires_at',
        'certificate_meta',
        'activated_at',
        'suspended_at',
        'revoked_at',
        'administered_by',
    ];

    protected $casts = [
        'certificate_meta' => 'array',
        'certificate_expires_at' => 'datetime',
        'activated_at' => 'datetime',
        'suspended_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];
}
