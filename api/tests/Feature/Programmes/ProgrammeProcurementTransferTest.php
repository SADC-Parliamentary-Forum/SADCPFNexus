<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeProcurementItem;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeProcurementTransferTest extends TestCase
{
    private function approvedProgrammeWithItems(Tenant $tenant, int $userId): array
    {
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $userId,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'Procurement Transfer Test',
            'status' => 'approved', 'approved_at' => now(),
        ]);
        $item1 = ProgrammeProcurementItem::create([
            'programme_id' => $programme->id, 'description' => 'Catering', 'estimated_cost' => 500,
        ]);
        $item2 = ProgrammeProcurementItem::create([
            'programme_id' => $programme->id, 'description' => 'Printing', 'estimated_cost' => 150,
        ]);
        return [$programme, $item1, $item2];
    }

    public function test_send_to_procurement_creates_one_request_with_multiple_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        [$programme, $item1, $item2] = $this->approvedProgrammeWithItems($tenant, $user->id);

        $response = $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item1->id, $item2->id],
            'request_title'        => 'Procurement requirements for approved activity',
        ]);

        $response->assertOk();
        $requestId = $response->json('data.id');

        $this->assertDatabaseCount('procurement_items', 2);
        $this->assertDatabaseHas('programme_procurement_items', ['id' => $item1->id, 'procurement_request_id' => $requestId]);
        $this->assertDatabaseHas('programme_procurement_items', ['id' => $item2->id, 'procurement_request_id' => $requestId]);
    }

    public function test_send_to_procurement_rejects_when_programme_not_approved(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'Not Approved', 'status' => 'draft',
        ]);
        $item = ProgrammeProcurementItem::create(['programme_id' => $programme->id, 'description' => 'X', 'estimated_cost' => 10]);

        $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item->id],
            'request_title'        => 'Too Early',
        ])->assertUnprocessable();
    }

    public function test_send_to_procurement_rejects_already_linked_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        [$programme, $item1] = $this->approvedProgrammeWithItems($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item1->id], 'request_title' => 'First',
        ])->assertOk();

        $http->postJson("/api/v1/programmes/{$programme->id}/send-to-procurement", [
            'procurement_item_ids' => [$item1->id], 'request_title' => 'Duplicate',
        ])->assertStatus(409);
    }
}
