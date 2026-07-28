<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\WeeklyReport;
use App\Models\WeeklyReportAuditEvent;
use App\Models\User;

class WeeklyReportAuditService
{
    public function record(
        ?WeeklyReport $report,
        User $actor,
        string $eventType,
        array $payload = [],
        ?int $periodId = null,
    ): WeeklyReportAuditEvent {
        return WeeklyReportAuditEvent::create([
            'tenant_id' => $actor->tenant_id,
            'weekly_report_id' => $report?->id,
            'period_id' => $periodId ?? $report?->period_id,
            'actor_id' => $actor->id,
            'event_type' => $eventType,
            'payload' => $payload,
            'ip_address' => request()?->ip(),
            'created_at' => now(),
        ]);
    }
}
