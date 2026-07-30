<?php

namespace App\Console\Commands;

use App\Modules\PeopleAuthority\Services\PeoplePhase2Service;
use Illuminate\Console\Command;

class PeopleAuthorityOpenRecertificationsCommand extends Command
{
    protected $signature = 'people-authority:open-recertifications';

    protected $description = 'Open scheduled role recertification campaigns when enabled (never auto-decides items)';

    public function handle(PeoplePhase2Service $phase2): int
    {
        $opened = $phase2->runScheduledRecertifications();
        $this->info("Opened {$opened} recertification campaign(s).");

        return self::SUCCESS;
    }
}
