<?php

namespace App\Console\Commands;

use App\Modules\Travel\Services\TravelToilService;
use Illuminate\Console\Command;

class TravelGenerateToilCandidates extends Command
{
    protected $signature = 'travel:generate-toil-candidates';

    protected $description = 'Nightly catch-up: generate TOIL candidates for returned/approved travel (never creates leave)';

    public function handle(TravelToilService $toilService): int
    {
        $n = $toilService->generateCatchUp();
        $this->info("Generated/ensured {$n} TOIL candidate row(s). auto_create_leave=" . (config('travel.auto_create_leave_from_travel') ? 'true' : 'false'));

        return self::SUCCESS;
    }
}
