<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\TimesheetEntry;
use App\Models\User;

class AssignmentTimesheetCouplingService
{
    public function hours(Assignment $assignment, User $viewer): array
    {
        abort_unless((int) $assignment->tenant_id === (int) $viewer->tenant_id, 404);

        $logged = (float) TimesheetEntry::query()
            ->where('assignment_id', $assignment->id)
            ->sum('hours');

        return [
            'assignment_id' => $assignment->id,
            'logged_hours' => $logged,
            'estimated_hours' => $assignment->estimated_hours !== null ? (float) $assignment->estimated_hours : null,
            'auto_complete' => false,
            'note' => 'Hours are informational. Completing the assignment remains a human action.',
        ];
    }
}
