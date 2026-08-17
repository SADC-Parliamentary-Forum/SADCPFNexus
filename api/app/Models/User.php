<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
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

    public const STATUS_INVITED = 'invited';
    public const STATUS_PENDING_ACTIVATION = 'pending_activation';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_LOCKED = 'locked';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_DISABLED = 'disabled';
    public const STATUS_OFFBOARDED = 'offboarded';

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
        'account_status',
        'status_changed_at',
        'suspended_at',
        'disabled_at',
        'offboarded_at',
        'invited_at',
        'activated_at',
        'status_reason',
        'mfa_enabled',
        'mfa_secret',
        'must_reset_password',
        'password_changed_at',
        'setup_completed',
        'last_login_at',
        'idle_timeout_minutes',
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
            'last_login_at'          => 'datetime',
            'password'          => 'hashed',
            'is_active'              => 'boolean',
            'status_changed_at'      => 'datetime',
            'suspended_at'           => 'datetime',
            'disabled_at'            => 'datetime',
            'offboarded_at'          => 'datetime',
            'invited_at'             => 'datetime',
            'activated_at'           => 'datetime',
            'mfa_enabled'            => 'boolean',
            'must_reset_password'    => 'boolean',
            'password_changed_at'    => 'datetime',
            'setup_completed'        => 'boolean',
            'date_of_birth'     => 'date',
            'join_date'         => 'date',
            'skills'            => 'array',
            'qualifications'    => 'array',
        ];
    }

    /**
     * Null means “use SESSION_LIFETIME”. Built-in integer casts would turn null into 0.
     */
    protected function idleTimeoutMinutes(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value === null ? null : (int) $value,
            set: fn ($value) => $value === null || $value === '' ? null : (int) $value,
        );
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

    public function accountInvitations(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(AccountInvitation::class);
    }

    public function latestAccountInvitation(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(AccountInvitation::class)->latestOfMany();
    }

    public function passwordHistories(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PasswordHistory::class);
    }

    /**
     * Whether the user has a system administrator role (accepts both "System Admin" and "System Administrator").
     */
    public function isSystemAdmin(): bool
    {
        return $this->hasAnyRole(['System Admin', 'System Administrator', 'super-admin', 'admin', 'Admin']);
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

    public function accountAllowsAuthentication(): bool
    {
        return (bool) $this->is_active && $this->account_status === self::STATUS_ACTIVE;
    }

    public function authenticationBlockReason(): ?string
    {
        if ($this->accountAllowsAuthentication()) {
            return null;
        }

        return match ($this->account_status) {
            self::STATUS_INVITED,
            self::STATUS_PENDING_ACTIVATION => 'pending_activation',
            self::STATUS_LOCKED => 'locked',
            self::STATUS_SUSPENDED => 'suspended',
            self::STATUS_OFFBOARDED => 'offboarded',
            default => 'disabled',
        };
    }

    public function isPrivilegedAccount(): bool
    {
        return $this->isSystemAdmin()
            || $this->hasAnyRole([
                'Secretary General',
                'Finance Controller',
                'HR Manager',
                'HR Administrator',
                'Procurement Officer',
                'Platform Administrator',
                'Technical Administrator',
                'Security Administrator',
                'Read-Only Operations Viewer',
            ]);
    }
}
