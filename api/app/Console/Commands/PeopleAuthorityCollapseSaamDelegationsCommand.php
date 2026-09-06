<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Modules\PeopleAuthority\Services\DelegationCollapseService;
use Illuminate\Console\Command;

class PeopleAuthorityCollapseSaamDelegationsCommand extends Command
{
    protected $signature = 'people-authority:collapse-saam-delegations {--tenant= : Limit to one tenant id}';

    protected $description = 'Mirror unmatched SAAM DelegatedAuthority rows into People & Authority IdentityDelegation (never auto-revokes)';

    public function handle(DelegationCollapseService $collapse): int
    {
        $tenantId = $this->option('tenant');
        $query = Tenant::query()->orderBy('id');
        if ($tenantId !== null && $tenantId !== '') {
            $query->where('id', (int) $tenantId);
        }

        $tenants = $query->get();
        $scanned = 0;
        $mirrored = 0;
        foreach ($tenants as $tenant) {
            $result = $collapse->migrateTenant((int) $tenant->id);
            $scanned += $result['scanned'];
            $mirrored += $result['mirrored'];
        }

        $this->info("Scanned {$scanned} SAAM delegation(s); mirrored {$mirrored} into People & Authority.");

        return self::SUCCESS;
    }
}
