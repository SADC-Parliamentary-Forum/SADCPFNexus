<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Modules\Risk\Services\RiskKriService;
use Illuminate\Console\Command;

class RiskEvaluateKris extends Command
{
    protected $signature = 'risk:evaluate-kris {--tenant= : Limit to a single tenant id}';

    protected $description = 'Evaluate automated Key Risk Indicators from Nexus module data and raise breach alerts';

    public function handle(RiskKriService $service): int
    {
        $tenantId = $this->option('tenant');
        $query = Tenant::query()->when($tenantId, fn ($q) => $q->where('id', $tenantId));

        $count = 0;
        $query->each(function (Tenant $tenant) use ($service, &$count) {
            $service->evaluateTenant((int) $tenant->id, true);
            $count++;
            $this->info("Evaluated KRIs for tenant {$tenant->id}");
        });

        $this->info("Done. Tenants processed: {$count}");

        return self::SUCCESS;
    }
}
