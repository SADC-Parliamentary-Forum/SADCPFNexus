<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\PlatformAudit\AuditEvent;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Generic HTTPS SIEM webhook. Disabled until AUDIT_SIEM_DRIVER=http and URL are set.
 * Never invents credentials. Ingest must succeed even if the sink fails.
 */
class HttpSiemSink
{
    public function isEnabled(): bool
    {
        return (string) config('audit.siem_driver', 'null') === 'http'
            && filled(config('audit.siem_http_url'));
    }

    public function forward(AuditEvent $event): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        try {
            $response = Http::withToken((string) config('audit.siem_http_token', ''))
                ->timeout(5)
                ->post((string) config('audit.siem_http_url'), [
                    'uuid' => $event->uuid,
                    'event_key' => $event->event_key,
                    'tenant_id' => $event->tenant_id,
                    'outcome' => $event->outcome,
                    'occurred_at' => optional($event->occurred_at)?->toIso8601String(),
                    'subject_type' => $event->subject_type,
                    'subject_id' => $event->subject_id,
                ]);

            if (! $response->successful()) {
                Log::warning('audit.siem_http_rejected', [
                    'event_uuid' => $event->uuid,
                    'status' => $response->status(),
                ]);
            }
        } catch (Throwable $e) {
            Log::warning('audit.siem_http_failed', [
                'event_uuid' => $event->uuid,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
