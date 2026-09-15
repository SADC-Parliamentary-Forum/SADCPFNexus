<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetHandover extends Model
{
    public const TYPES = ['issue', 'transfer', 'return'];

    public const TARGETS = ['person', 'department', 'location', 'pool', 'vehicle_facility'];

    public const PERSON_AWAITING = ['awaiting_acceptance', 'partially_accepted', 'return_initiated'];

    protected $fillable = [
        'tenant_id', 'reference', 'type', 'custody_target_type', 'status',
        'from_user_id', 'from_department_id', 'from_location_id',
        'to_user_id', 'to_department_id', 'to_location_id', 'to_asset_id',
        'notes', 'declaration_version', 'signature_event_id', 'certificate_path',
        'issued_at', 'sent_at', 'accepted_at', 'expires_at',
        'last_reminded_at', 'reminders_sent', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'sent_at' => 'datetime',
            'accepted_at' => 'datetime',
            'expires_at' => 'datetime',
            'last_reminded_at' => 'datetime',
        ];
    }

    public function requiresPersonSignature(): bool
    {
        return $this->custody_target_type === 'person' && $this->type !== 'return';
    }

    public function lines(): HasMany
    {
        return $this->hasMany(AssetHandoverLine::class, 'handover_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(AssetLocation::class, 'to_location_id');
    }

    public function toDepartment(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'to_department_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function signatureEvent(): BelongsTo
    {
        return $this->belongsTo(SignatureEvent::class, 'signature_event_id');
    }
}
