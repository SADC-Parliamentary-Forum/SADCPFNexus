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
        'vendor_id',
        'position_id',
        'name',
        'email',
        'password',
        'employee_number',
        'job_title',
        'classification',
        'is_active',
        'mfa_enabled',
        'mfa_secret',
        'must_reset_password',
        'setup_completed',
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
            'is_active'              => 'boolean',
            'mfa_enabled'            => 'boolean',
            'must_reset_password'    => 'boolean',
            'setup_completed'        => 'boolean',
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

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function position(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function portfolios(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Portfolio::class);
    }

    public function profileDocuments(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')
            ->where('document_type', '!=', 'appraisal_evidence')
            ->whereIn('document_type', Attachment::PROFILE_DOCUMENT_TYPES);
    }

    /**
     * Whether the user has a system administrator role (accepts both "System Admin" and "System Administrator").
     */
    public function isSystemAdmin(): bool
    {
        return $this->hasAnyRole(['System Admin', 'System Administrator', 'super-admin']);
    }

    /**
     * Whether the user has the Secretary General role (final approver in workflow; may approve own request only after workflow steps).
     */
    public function isSecretaryGeneral(): bool
    {
        return $this->hasRole('Secretary General');
    }

    public function isSupplier(): bool
    {
        return $this->hasAnyRole(['Supplier', 'Supplier Finance User']);
    }
}
