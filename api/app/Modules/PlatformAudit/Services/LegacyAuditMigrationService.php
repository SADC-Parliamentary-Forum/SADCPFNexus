<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\AuditLog;
use App\Models\PlatformAudit\AuditEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Migrates historical audit_logs into platform audit_events without fabricating IP/session.
 */
class LegacyAuditMigrationService
{
    public function __construct(
        private readonly AuditEventIngestionService $ingestion,
        private readonly LegacyEventMapper $mapper,
        private readonly EventTypeRegistryService $registry,
    ) {}

    /**
     * @return array{migrated: int, skipped: int, partial: int, unmapped: int}
     */
    public function migrateTenant(int $tenantId, int $limit = 5000): array
    {
        if (! Schema::hasTable('audit_events') || ! Schema::hasTable('audit_logs')) {
            return ['migrated' => 0, 'skipped' => 0, 'partial' => 0, 'unmapped' => 0];
        }

        $this->registry->ensureSeeded();

        $stats = ['migrated' => 0, 'skipped' => 0, 'partial' => 0, 'unmapped' => 0];

        AuditLog::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('id')
            ->chunkById(200, function ($logs) use (&$stats, $tenantId, $limit) {
                foreach ($logs as $log) {
                    if ($stats['migrated'] + $stats['partial'] + $stats['unmapped'] >= $limit) {
                        return false;
                    }

                    if (AuditEvent::query()->where('legacy_audit_log_id', $log->id)->exists()) {
                        $stats['skipped']++;
                        continue;
                    }

                    $mappedKey = $this->mapper->mapKey($log->event);
                    $status = 'Migrated-Complete';
                    if ($mappedKey === 'other.controlled') {
                        $status = 'Migrated-Unmapped';
                        $stats['unmapped']++;
                    } elseif ($log->ip_address === null && $log->user_agent === null) {
                        $status = 'Migrated-Partial';
                        $stats['partial']++;
                    } else {
                        $stats['migrated']++;
                    }

                    $mapped = $this->mapper->map($log->event, [
                        'tenant_id' => $tenantId,
                        'user_id' => $log->user_id,
                        'auditable_type' => $log->auditable_type,
                        'auditable_id' => $log->auditable_id,
                        'old_values' => $log->old_values,
                        'new_values' => $log->new_values,
                        'tags' => $log->tags,
                    ]);

                    // Do NOT fabricate missing IP/session — pass through nulls explicitly.
                    $mapped['ip_address'] = $log->ip_address;
                    $mapped['user_agent'] = $log->user_agent;
                    $mapped['url'] = $log->url;
                    $mapped['occurred_at'] = $log->created_at;
                    $mapped['migration_status'] = $status;
                    $mapped['legacy_audit_log_id'] = $log->id;
                    $mapped['idempotency_key'] = 'legacy:'.$log->id;
                    $mapped['uuid'] = (string) Str::uuid();
                    $mapped['actor_id'] = $log->user_id;
                    $mapped['actor_type'] = $log->user_id ? 'human' : 'anonymous';

                    try {
                        DB::transaction(function () use ($mapped) {
                            $this->ingestion->appendImmutable($mapped);
                        });
                    } catch (\Throwable $e) {
                        Log::warning('platform_audit.migration_row_failed', [
                            'legacy_id' => $log->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }

                return true;
            });

        return $stats;
    }
}
