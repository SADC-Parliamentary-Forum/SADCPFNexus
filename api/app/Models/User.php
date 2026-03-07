<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasRoles;

    protected $guard_name = 'sanctum';

    protected $fillable = [
        'tenant_id',
        'department_id',
        'name',
        'email',
        'password',
        'employee_number',
        'job_title',
        'classification',
        'is_active',
        'mfa_enabled',
        'mfa_secret',
        'last_login_at',
        'bio',
        'date_of_birth',
        'join_date',
        'phone',
        'nationality',
        'gender',
        'marital_status',
        'emergency_contact_name',
        'emergency_contact_relationship',
        'emergency_contact_phone',
        'address_line1',
        'address_line2',
        'city',
        'country',
        'skills',
        'qualifications',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'mfa_secret',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at'     => 'datetime',
            'password'          => 'hashed',
            'is_active'         => 'boolean',
            'mfa_enabled'       => 'boolean',
            'date_of_birth'     => 'date',
            'join_date'         => 'date',
            'skills'            => 'array',
            'qualifications'    => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function portfolios(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Portfolio::class);
    }
}
