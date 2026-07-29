<?php

namespace App\Modules\Leave\Services;

use App\Models\LeaveRequest;
use App\Models\User;

/**
 * Team calendar privacy: medical/sick leave is masked for non-HR viewers.
 */
class LeaveCalendarPrivacyService
{
    public const MEDICAL_TYPES = ['sick'];

    public function canViewUnmaskedMedical(User $viewer): bool
    {
        if ($viewer->hasAnyRole(['HR Manager', 'HR Administrator'])) {
            return true;
        }

        return ! $viewer->isSystemAdmin()
            && ! $viewer->hasRole('super-admin')
            && $viewer->hasPermissionTo('hr.admin');
    }

    public function present(LeaveRequest $leave, User $viewer, bool $forceOwn = false): array
    {
        $rawType = (string) $leave->leave_type;
        $isMedical = in_array($rawType, self::MEDICAL_TYPES, true);
        $unmasked = $forceOwn || $this->canViewUnmaskedMedical($viewer);
        $masked = $isMedical && ! $unmasked;

        $type = $masked ? 'on_leave' : $rawType;

        return [
            'id' => $leave->id,
            'reference' => $leave->reference_number,
            'leave_type' => $type,
            'display_label' => $this->displayLabel($type, $rawType, $masked),
            'category' => $this->category($rawType, $masked),
            'color_key' => $this->colorKey($rawType, $masked),
            'is_masked' => $masked,
            'start_date' => $leave->start_date?->toDateString(),
            'end_date' => $leave->end_date?->toDateString(),
            'days_requested' => $leave->days_requested,
            'status' => $leave->status,
            'requester' => $leave->requester ? [
                'id' => $leave->requester->id,
                'name' => $leave->requester->name,
                'job_title' => $leave->requester->job_title,
                'department_id' => $leave->requester->department_id,
            ] : null,
        ];
    }

    private function displayLabel(string $publicType, string $rawType, bool $masked): string
    {
        if ($masked) {
            return 'On leave';
        }

        return match ($rawType) {
            'annual' => 'Annual leave',
            'sick' => 'Sick leave',
            'maternity' => 'Maternity leave',
            'paternity' => 'Paternity leave',
            'compassionate' => 'Compassionate leave',
            'study' => 'Study leave',
            'unpaid' => 'Unpaid leave',
            'home' => 'Home leave',
            'lil' => 'LIL',
            'special' => 'Special leave',
            'toil' => 'TOIL',
            default => ucfirst(str_replace('_', ' ', $publicType)).' leave',
        };
    }

    private function category(string $rawType, bool $masked): string
    {
        if ($masked || in_array($rawType, self::MEDICAL_TYPES, true)) {
            return 'medical';
        }

        return match ($rawType) {
            'annual', 'home', 'lil', 'toil' => 'annual',
            'maternity', 'paternity', 'compassionate', 'special' => 'special',
            'study', 'unpaid' => 'other',
            default => 'other',
        };
    }

    private function colorKey(string $rawType, bool $masked): string
    {
        if ($masked) {
            return 'private';
        }

        return match ($this->category($rawType, false)) {
            'medical' => 'medical',
            'annual' => 'annual',
            'special' => 'special',
            default => 'other',
        };
    }
}
