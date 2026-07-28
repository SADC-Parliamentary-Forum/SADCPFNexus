<?php

namespace App\Console\Commands;

use App\Modules\Assignments\Services\AssignmentService;
use Illuminate\Console\Command;

class AssignmentsProcessReminders extends Command
{
    protected $signature = 'assignments:process-reminders';

    protected $description = 'Send due assignment reminders and escalate unclaimed/overdue work (Phase 1).';

    public function handle(AssignmentService $service): int
    {
        $count = $service->processRemindersAndEscalations();
        $this->info("Processed {$count} reminder/escalation actions.");

        return self::SUCCESS;
    }
}
