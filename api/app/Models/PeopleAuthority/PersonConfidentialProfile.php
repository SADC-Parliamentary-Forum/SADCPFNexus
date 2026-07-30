<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PersonConfidentialProfile extends Model
{
    protected $table = 'person_confidential_profiles';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'date_of_birth',
        'national_id',
        'passport_number',
        'nationality',
        'gender',
        'marital_status',
        'home_address_line1',
        'home_address_line2',
        'home_city',
        'home_country',
        'emergency_contact_name',
        'emergency_contact_relationship',
        'emergency_contact_phone',
        'medical_notes',
        'bank_details_encrypted',
        'extra',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'medical_notes' => 'array',
        'bank_details_encrypted' => 'array',
        'extra' => 'array',
    ];
}
