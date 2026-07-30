<?php

namespace App\Models;

use App\Modules\PlatformAudit\Services\AuditEventIngestionService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;

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

    /**
     * Legacy compatibility writer. Remains operational; also dual-writes to Platform Audit Trail
     * via adapter when the Phase 1 store is available.
     */
    public static function record(string $event, array $context = []): static
    {
        $request = request();
        $user = auth()->user();

        $lastLog = static::latest('id')->first();
        $previousHash = $lastLog?->entry_hash ?? '0';

        $entry = [
            'tenant_id'     => $context['tenant_id'] ?? $user?->tenant_id ?? null,
            'user_id'       => $context['user_id'] ?? $user?->id ?? null,
            'event'         => $event,
            'auditable_type'=> $context['auditable_type'] ?? null,
            'auditable_id'  => $context['auditable_id'] ?? null,
            'old_values'    => $context['old_values'] ?? null,
            'new_values'    => $context['new_values'] ?? null,
            'url'           => array_key_exists('url', $context) ? $context['url'] : $request?->fullUrl(),
            'ip_address'    => array_key_exists('ip_address', $context) ? $context['ip_address'] : $request?->ip(),
            'user_agent'    => array_key_exists('user_agent', $context) ? $context['user_agent'] : $request?->userAgent(),
            'tags'          => $context['tags'] ?? null,
            'previous_hash' => $previousHash,
        ];

        $entry['entry_hash'] = hash('sha256', json_encode($entry) . $previousHash);

        $log = static::create($entry);

        // Compatibility adapter — never break PIF/legacy writers if platform ingest fails.
        if (Schema::hasTable('audit_events')) {
            try {
                app(AuditEventIngestionService::class)->ingestFromLegacy($event, array_merge($context, [
                    'tenant_id' => $log->tenant_id,
                    'user_id' => $log->user_id,
                ]), $log->id);
            } catch (Throwable $e) {
                Log::warning('platform_audit.dual_write_failed', [
                    'legacy_event' => $event,
                    'legacy_id' => $log->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $log;
    }
}
