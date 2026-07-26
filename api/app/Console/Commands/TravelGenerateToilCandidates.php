<?php

namespace App\Console\Commands;

use App\Modules\Travel\Services\TravelToilService;
use Illuminate\Console\Command;

class TravelGenerateToilCandidates extends Command
{
    protected $signature = 'travel:generate-toil-candidates';

    protected $description = 'Nightly: auto-generate TOIL candidates + expire overdue accruals (never creates leave)';

    public function handle(TravelToilService $toilService): int
    {
        $generated = $toilService->generateCatchUp();
        $expired = $toilService->expireOverdue();

        $this->info(sprintf(
            'TOIL catch-up: %d candidate row(s); expired %d. auto_generate=%s auto_create_leave=%s',
            $generated,
            $expired,
            config('travel.auto_generate_candidates') ? 'true' : 'false',
            config('travel.auto_create_leave_from_travel') ? 'true' : 'false'
        ));

        return self::SUCCESS;
    }
}
