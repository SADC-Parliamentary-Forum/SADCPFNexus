<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use Tests\TestCase;

class SplitPurchaseWarningTest extends TestCase
{
    private function draftPayload(array $overrides = []): array
    {
        return array_merge([
            'title'           => 'Office Equipment Batch',
            'description'     => 'Procurement of office equipment',
            'category'        => 'goods',
            'estimated_value' => 60000,
            'currency'        => 'NAD',
            'budget_line'     => 'BL-OPS-001',
        ], $overrides);
    }

    private function createDraft(Tenant $tenant, int $requesterId, array $overrides = []): ProcurementRequest
    {
        return ProcurementRequest::create(array_merge([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requesterId,
            'title'           => 'Office Equipment Batch',
            'description'     => 'Procurement of office equipment',
            'category'        => 'goods',
            'estimated_value' => 60000,
            'currency'        => 'NAD',
            'budget_line'     => 'BL-OPS-001',
            'status'          => 'draft',
        ], $overrides));
    }

    public function test_submit_split_without_justification_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $user->id,
            'title'           => 'Office Equipment Batch A',
            'description'     => 'First batch',
            'category'        => 'goods',
            'estimated_value' => 55000,
            'currency'        => 'NAD',
            'budget_line'     => 'BL-OPS-001',
            'status'          => 'submitted',
            'submitted_at'    => now()->subDays(3),
            'created_at'      => now()->subDays(3),
        ]);

        $req = $this->createDraft($tenant, $user->id, [
            'title'           => 'Office Equipment Batch B',
            'estimated_value' => 55000,
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['split_justification']);
    }

    public function test_submit_split_with_justification_succeeds_and_audits(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $user->id,
            'title'           => 'Office Equipment Batch A',
            'description'     => 'First batch',
            'category'        => 'goods',
            'estimated_value' => 55000,
            'currency'        => 'NAD',
            'budget_line'     => 'BL-OPS-001',
            'status'          => 'submitted',
            'submitted_at'    => now()->subDays(3),
            'created_at'      => now()->subDays(3),
        ]);

        $req = $this->createDraft($tenant, $user->id, [
            'title'           => 'Office Equipment Batch B',
            'estimated_value' => 55000,
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/submit", [
            'split_justification' => 'Separate delivery schedules for two programme sites.',
        ])->assertOk()
          ->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('procurement_requests', [
            'id'     => $req->id,
            'status' => 'submitted',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'event'          => 'procurement.split_justification',
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $req->id,
        ]);
    }

    public function test_submit_under_threshold_alone_not_flagged(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $user->id,
            'title'           => 'Small Supplies Order',
            'description'     => 'Under limit',
            'category'        => 'goods',
            'estimated_value' => 40000,
            'currency'        => 'NAD',
            'status'          => 'submitted',
            'submitted_at'    => now()->subDays(2),
            'created_at'      => now()->subDays(2),
        ]);

        $req = $this->createDraft($tenant, $user->id, [
            'title'           => 'Small Supplies Order 2',
            'estimated_value' => 40000,
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');
    }
}
