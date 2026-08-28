<?php

namespace App\Modules\Timesheets\Services;

use App\Models\AttendanceClockEvent;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AttendanceClockService
{
    public function clock(User $actor, array $data): AttendanceClockEvent
    {
        $direction = strtolower((string) ($data['direction'] ?? ''));
        if (! in_array($direction, ['in', 'out'], true)) {
            throw ValidationException::withMessages(['direction' => ['Direction must be in or out.']]);
        }
        $method = strtolower((string) ($data['method'] ?? 'manual'));
        if (! in_array($method, ['manual', 'biometric', 'badge'], true)) {
            throw ValidationException::withMessages(['method' => ['Unknown clock method.']]);
        }
        if ($method === 'biometric' && empty($data['device_attested'])) {
            throw ValidationException::withMessages([
                'device_attested' => ['Biometric clock-in requires a successful device attestation.'],
            ]);
        }

        $event = AttendanceClockEvent::query()->create([
            'tenant_id' => $actor->tenant_id,
            'user_id' => $actor->id,
            'direction' => $direction,
            'method' => $method,
            'device_attested' => (bool) ($data['device_attested'] ?? false),
            'device_id' => $data['device_id'] ?? null,
            'clocked_at' => now(),
        ]);

        AuditLog::record('timesheets.attendance.clock', [
            'auditable_type' => AttendanceClockEvent::class,
            'auditable_id' => $event->id,
            'new_values' => ['direction' => $direction, 'method' => $method],
            'tags' => 'timesheets,attendance',
        ]);

        return $event;
    }
}
