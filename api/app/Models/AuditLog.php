<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public const UPDATED_AT = null; // Immutable — no updated_at

    protected $fillable = [
        'tenant_id',
        'user_id',
        'event',
        'auditable_type',
        'auditable_id',
        'old_values',
        'new_values',
        'url',
        'ip_address',
        'user_agent',
        'tags',
        'entry_hash',
        'previous_hash',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'tags'       => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // Prevent updates and deletes at Eloquent level
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(string $event, array $context = []): static
    {
        $request = request();
        $user = auth()->user();

        $lastLog = static::latest('id')->first();
        $previousHash = $lastLog?->entry_hash ?? '0';

        $entry = [
            'tenant_id'     => $user?->tenant_id ?? null,
            'user_id'       => $user?->id ?? null,
            'event'         => $event,
            'auditable_type'=> $context['auditable_type'] ?? null,
            'auditable_id'  => $context['auditable_id'] ?? null,
            'old_values'    => $context['old_values'] ?? null,
            'new_values'    => $context['new_values'] ?? null,
            'url'           => $request?->fullUrl(),
            'ip_address'    => $request?->ip(),
            'user_agent'    => $request?->userAgent(),
            'tags'          => $context['tags'] ?? null,
            'previous_hash' => $previousHash,
        ];

        $entry['entry_hash'] = hash('sha256', json_encode($entry) . $previousHash);

        return static::create($entry);
    }
}
