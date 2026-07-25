<?php

namespace Tests\Feature\Procurement;

use App\Models\Contract;
use App\Models\ContractMilestone;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class ContractMilestoneTest extends TestCase
{
    public function test_milestone_crud_and_complete(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'Vendor', 'is_approved' => true, 'is_active' => true]);

        $contract = Contract::create([
            'tenant_id'  => $tenant->id,
            'vendor_id'  => $vendor->id,
            'title'      => 'Consulting Agreement',
            'start_date' => now()->toDateString(),
            'end_date'   => now()->addMonths(6)->toDateString(),
            'value'      => 150_000,
            'currency'   => 'NAD',
            'status'     => 'active',
            'created_by' => $officer->id,
        ]);

        $created = $http->postJson("/api/v1/procurement/contracts/{$contract->id}/milestones", [
            'title'    => 'Inception report',
            'due_date' => now()->addMonth()->toDateString(),
            'amount'   => 30_000,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $mid = $created->json('data.id');

        $http->getJson("/api/v1/procurement/contracts/{$contract->id}/milestones")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $http->postJson("/api/v1/procurement/contracts/{$contract->id}/milestones/{$mid}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertNotNull(ContractMilestone::find($mid)->completed_at);
    }
}
