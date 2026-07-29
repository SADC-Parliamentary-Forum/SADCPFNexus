<?php

namespace App\Console\Commands;

use App\Modules\Assignments\Services\AssignmentGoogleCalendarSyncService;
use Illuminate\Console\Command;

class AssignmentsSyncGoogleCalendar extends Command
{
    protected $signature = 'assignments:sync-google-calendar
        {--tenant= : Limit to a single tenant id}
        {--dry-run : Fetch/map without persisting}
        {--direction=both : push|pull|both}';

    protected $description = 'Two-way sync of assignment due dates with Google Calendar (no-op when credentials absent)';

    public function handle(AssignmentGoogleCalendarSyncService $sync): int
    {
        $result = $sync->sync([
            'tenant' => $this->option('tenant'),
            'dry_run' => (bool) $this->option('dry-run'),
            'direction' => $this->option('direction'),
        ]);

        $this->info(sprintf(
            'Google Calendar sync: status=%s pushed=%d pulled=%d skipped=%d dry_run=%s',
            $result['status'],
            $result['pushed'],
            $result['pulled'],
            $result['skipped'],
            $result['dry_run'] ? 'yes' : 'no'
        ));

        foreach ($result['errors'] as $error) {
            $this->warn("  - {$error}");
        }

        return $result['status'] === 'error' ? self::FAILURE : self::SUCCESS;
    }
}
