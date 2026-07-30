<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationReminder;
use App\Modules\WorkflowEngine\Services\SlaCalendarService;
use Illuminate\Support\Carbon;

/**
 * Calendar-aware reminder scheduling using Workflow SLA working calendars when present.
 */
class CalendarReminderService
{
    public function __construct(private readonly SlaCalendarService $calendars) {}

    public function schedule(
        int $tenantId,
        string $sourceType,
        int $sourceId,
        string $eventKey,
        Carbon $from,
        int $workingHoursOffset,
        ?int $userId = null,
        ?string $calendarCode = null,
        ?string $priority = null,
        ?array $payload = null,
    ): NotificationReminder {
        $calendar = $this->calendars->resolveCalendar($tenantId, $calendarCode);
        $due = $this->calendars->computeDueAt($from, max(1, $workingHoursOffset), $calendar, $priority);

        return NotificationReminder::create([
            'tenant_id' => $tenantId,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'user_id' => $userId,
            'event_key' => $eventKey,
            'due_at' => $due,
            'calendar_code' => $calendar?->code ?? $calendarCode,
            'status' => 'pending',
            'payload' => $payload,
        ]);
    }
}
