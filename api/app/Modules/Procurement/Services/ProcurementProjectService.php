<?php

namespace App\Modules\Procurement\Services;

use App\Models\ProcurementProject;
use App\Models\Tenant;
use App\Models\User;

class ProcurementProjectService
{
    public function ensureDefaults(Tenant $tenant): ProcurementProject
    {
        return ProcurementProject::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'FORUM'],
            [
                'name' => 'Forum',
                'funding_source' => 'core',
                'is_active' => true,
                'allows_no_po_payment' => false,
            ]
        );
    }

    public function list(Tenant $tenant): \Illuminate\Support\Collection
    {
        $this->ensureDefaults($tenant);

        return ProcurementProject::query()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
    }

    public function create(Tenant $tenant, User $user, array $data): ProcurementProject
    {
        $this->ensureDefaults($tenant);

        return ProcurementProject::create([
            'tenant_id' => $tenant->id,
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
            'funding_source' => $data['funding_source'] ?? 'core',
            'donor_id' => $data['donor_id'] ?? null,
            'programme_id' => $data['programme_id'] ?? null,
            'policy_profile_id' => $data['policy_profile_id'] ?? null,
            'account_code' => $data['account_code'] ?? null,
            'cost_centre' => $data['cost_centre'] ?? null,
            'allows_no_po_payment' => (bool) ($data['allows_no_po_payment'] ?? false),
            'is_active' => true,
        ]);
    }
}
