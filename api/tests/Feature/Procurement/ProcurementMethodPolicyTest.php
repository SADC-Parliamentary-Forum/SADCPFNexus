<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Procurement\Services\ProcurementService;
use Tests\TestCase;

class ProcurementMethodPolicyTest extends TestCase
{
    public function test_suggested_method_bands(): void
    {
        $service = app(ProcurementService::class);

        $this->assertSame('approved_supplier', $service->suggestMethod(10_000));
        $this->assertSame('approved_supplier', $service->suggestMethod(1));
        $this->assertSame('quotation', $service->suggestMethod(10_001));
        $this->assertSame('quotation', $service->suggestMethod(100_000));
        $this->assertSame('tender', $service->suggestMethod(100_001));
    }

    public function test_hod_approve_snapshots_policy_and_suggested_method(): void
    {
        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $hod = $this->makeUser('HOD', $tenant);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'Policy Snapshot Req',
            'description' => 'Needs method suggestion',
            'category' => 'goods',
            'estimated_value' => 45_000,
            'currency' => 'NAD',
            'status' => 'submitted',
            'procurement_method' => 'quotation',
        ]);

        $this->asUser($hod)
            ->postJson("/api/v1/procurement/requests/{$req->id}/hod-approve")
            ->assertOk()
            ->assertJsonPath('data.suggested_method', 'quotation')
            ->assertJsonPath('data.policy_profile_key', 'sadc_pf_core');

        $req->refresh();
        $this->assertSame('quotation', $req->suggested_method);
        $this->assertSame('sadc_pf_core', $req->policy_profile_key);
        $this->assertIsArray($req->policy_snapshot);
        $this->assertEquals(10_000, $req->policy_snapshot['direct_purchase_limit']);
        $this->assertEquals(100_000, $req->policy_snapshot['quotation_limit']);
    }

    public function test_method_override_requires_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Override Method',
            'description' => 'Needs override reason',
            'category' => 'goods',
            'estimated_value' => 45_000,
            'currency' => 'NAD',
            'status' => 'hod_approved',
            'suggested_method' => 'quotation',
            'procurement_method' => 'quotation',
            'policy_profile_key' => 'sadc_pf_core',
            'policy_snapshot' => [
                'direct_purchase_limit' => 10_000,
                'quotation_limit' => 100_000,
                'tender_threshold' => 100_000,
            ],
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/set-method", [
            'procurement_method' => 'tender',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['method_override_reason']);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/set-method", [
            'procurement_method' => 'tender',
            'method_override_reason' => 'Emergency sole-source tender path required by SG.',
        ])->assertOk()
            ->assertJsonPath('data.procurement_method', 'tender');

        $req->refresh();
        $this->assertSame('tender', $req->procurement_method);
        $this->assertNotNull($req->method_override_at);
        $this->assertSame($officer->id, $req->method_override_by);
    }
}
