<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetCategory;
use App\Models\Tenant;
use App\Modules\Assets\Support\AssetAccess;
use Tests\TestCase;

class AssetReportCatalogueTest extends TestCase
{
    public function test_catalogue_lists_fifty_two_governed_reports(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $res = $http->getJson('/api/v1/assets/report-catalogue')->assertOk();
        $data = $res->json('data');
        $this->assertCount(52, $data);
        $ids = collect($data)->pluck('id')->all();
        $this->assertContains('R01', $ids);
        $this->assertContains('R11', $ids);
        $this->assertContains('R52', $ids);
        $r01 = collect($data)->firstWhere('id', 'R01');
        $this->assertSame('Custody', $r01['family']);
        $this->assertSame('must', $r01['priority']);
        $this->assertContains('pdf', $r01['formats']);
        $this->assertContains('xlsx', $r01['formats']);
    }

    public function test_assigned_to_user_current_excludes_returned_and_includes_overdue_loan(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $staff->forceFill(['employee_number' => 'RW-0001', 'name' => 'Ronald Windwaai'])->save();
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);

        $current = [];
        for ($i = 1; $i <= 3; $i++) {
            $current[] = $this->seedAssignedAsset($tenant, $category->code, $staff->id, "Laptop {$i}", 'assigned');
        }
        $this->seedAssignedAsset($tenant, $category->code, $staff->id, 'Returned monitor', 'available', now()->subDays(10), now()->subDay());
        $this->seedAssignedAsset($tenant, $category->code, $staff->id, 'Overdue projector', 'loan_out', now()->subDays(20), null, now()->subDays(2), 'temporary_loan');

        $currentRes = $http->getJson('/api/v1/assets/reports/assigned-to-user?user_id='.$staff->id.'&mode=current')
            ->assertOk();
        $this->assertSame('R01', $currentRes->json('run.report_id'));
        $this->assertNotEmpty($currentRes->json('run.report_run_id'));
        $this->assertSame('current', $currentRes->json('run.parameters.mode'));
        $this->assertSame($staff->id, (int) $currentRes->json('custodian.id'));
        $this->assertSame('RW-0001', $currentRes->json('custodian.employee_number'));
        $this->assertCount(4, $currentRes->json('data'));
        $this->assertSame(4, (int) $currentRes->json('totals.count'));

        $historyRes = $http->getJson('/api/v1/assets/reports/assigned-to-user?user_id='.$staff->id.'&mode=history')
            ->assertOk();
        $this->assertCount(5, $historyRes->json('data'));

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'assets.report.viewed',
        ]);
    }

    public function test_assigned_to_user_hides_financials_without_permission(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $viewer = $this->makeUser('staff', $tenant);
        $viewer->givePermissionTo('assets.view');
        $http = $this->asUser($viewer);
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);
        $this->seedAssignedAsset($tenant, $category->code, $staff->id, 'Hidden finance laptop', 'assigned');

        $res = $http->getJson('/api/v1/assets/reports/assigned-to-user?user_id='.$staff->id.'&mode=current');
        if ($res->status() === 403) {
            $this->assertFalse(AssetAccess::canViewFinancials($viewer));

            return;
        }
        $res->assertOk();
        $row = $res->json('data.0');
        $this->assertArrayNotHasKey('purchase_value', $row);
        $this->assertArrayNotHasKey('book_value', $row);
        $this->assertArrayNotHasKey('accumulated_depreciation', $row);
    }

    public function test_tenant_users_can_be_found_by_staff_number(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $staff->forceFill(['employee_number' => 'RW-0001', 'name' => 'Ronald Windwaai'])->save();

        $res = $http->getJson('/api/v1/tenant-users?search=RW-0001')->assertOk();
        $hit = collect($res->json('data'))->firstWhere('id', $staff->id);
        $this->assertNotNull($hit);
        $this->assertSame('RW-0001', $hit['employee_number']);
        $this->assertSame('Ronald Windwaai', $hit['name']);
    }

    private function seedAssignedAsset(
        Tenant $tenant,
        string $category,
        int $userId,
        string $name,
        string $status,
        $assignedAt = null,
        $returnedAt = null,
        $expectedReturn = null,
        string $assignmentType = 'assigned',
    ): Asset {
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'PF-'.uniqid(),
            'tag_number' => 'PF/ICT/'.strtoupper(bin2hex(random_bytes(3))),
            'name' => $name,
            'category' => $category,
            'status' => $status,
            'assigned_to' => $returnedAt ? null : $userId,
            'issued_at' => $assignedAt ?? now()->subDays(5),
            'purchase_value' => 12000,
            'book_value' => 8000,
            'accumulated_depreciation' => 4000,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetAssignmentHistory::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $asset->id,
            'assigned_to' => $userId,
            'assignment_type' => $assignmentType,
            'assigned_at' => $assignedAt ?? now()->subDays(5),
            'returned_at' => $returnedAt,
            'acknowledged_at' => now()->subDays(4),
            'notes' => $expectedReturn ? 'expected_return:'.$expectedReturn->toDateString() : null,
        ]);

        return $asset;
    }
}
