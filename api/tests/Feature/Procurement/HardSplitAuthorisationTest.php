<?php

namespace Tests\Feature\Procurement;

use App\Models\BudgetReservation;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Modules\Procurement\Services\ProcurementService;
use Tests\TestCase;

class HardSplitAuthorisationTest extends TestCase
{
    private function makeSplitScenario(Tenant $tenant, int $requesterId): ProcurementRequest
    {
        ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requesterId,
            'title'           => 'Laptop Batch Alpha',
            'description'     => 'Laptops',
            'category'        => 'goods',
            'estimated_value' => 60_000,
            'currency'        => 'NAD',
            'status'          => 'approved',
            'budget_line'     => 'IT-EQUIP',
        ]);

        return ProcurementRequest::create([
            'tenant_id'           => $tenant->id,
            'requester_id'        => $requesterId,
            'title'               => 'Laptop Batch Beta',
            'description'         => 'More laptops',
            'category'            => 'goods',
            'estimated_value'     => 55_000,
            'currency'            => 'NAD',
            'status'              => 'hod_approved',
            'budget_line'         => 'IT-EQUIP',
            'split_justification' => 'Different cost centres; not a split.',
        ]);
    }

    public function test_hard_mode_blocks_approve_until_split_authorised(): void
    {
        config(['procurement.split_enforcement' => 'hard']);

        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $requester = $this->makeUser('staff', $tenant);
        $req = $this->makeSplitScenario($tenant, $requester->id);

        BudgetReservation::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'budget_line'            => 'IT-EQUIP',
            'reserved_amount'        => 55_000,
            'currency'               => 'NAD',
            'reserved_by'            => $officer->id,
        ]);

        $warning = app(ProcurementService::class)->detectSplitPurchase($req);
        $this->assertNotNull($warning);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['split_authorisation']);

        [$financeHttp] = $this->asFinanceController($tenant);
        $financeHttp->postJson("/api/v1/procurement/requests/{$req->id}/authorise-split", [
            'notes' => 'Reviewed — separate projects confirmed.',
        ])->assertOk();

        $req->refresh();
        $this->assertNotNull($req->split_authorised_by);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_soft_mode_allows_approve_with_justification_only(): void
    {
        config(['procurement.split_enforcement' => 'soft']);

        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $requester = $this->makeUser('staff', $tenant);
        $req = $this->makeSplitScenario($tenant, $requester->id);

        BudgetReservation::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'budget_line'            => 'IT-EQUIP',
            'reserved_amount'        => 55_000,
            'currency'               => 'NAD',
            'reserved_by'            => $officer->id,
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_staff_cannot_authorise_split(): void
    {
        config(['procurement.split_enforcement' => 'hard']);

        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $req = $this->makeSplitScenario($tenant, $requester->id);

        $this->asUser($requester)
            ->postJson("/api/v1/procurement/requests/{$req->id}/authorise-split", [
                'notes' => 'Self authorise',
            ])->assertForbidden();
    }
}
