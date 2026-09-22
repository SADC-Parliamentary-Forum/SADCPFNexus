<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetCategory;
use App\Models\AssetDepreciationRun;
use App\Models\AssetDepreciationRunLine;
use App\Models\AssetDisposal;
use App\Models\AssetIncident;
use App\Models\AssetInsurancePolicy;
use App\Models\AssetLocation;
use App\Models\AssetLocationHistory;
use App\Models\AssetMaintenanceRecord;
use App\Models\AssetTransfer;
use App\Models\AssetUnregisteredFind;
use App\Models\AssetVerificationCampaign;
use App\Models\AssetVerificationResult;
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
        $this->assertTrue($r01['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R09')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R11')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R21')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R29')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R31')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R38')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R40')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R52')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R07')['ready']);
        $this->assertTrue(collect($data)->firstWhere('id', 'R51')['ready']);
        $this->assertFalse(collect($data)->firstWhere('id', 'R24')['ready']);
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

    public function test_current_mode_includes_assigned_assets_without_history(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $staff->forceFill(['employee_number' => 'SADCPF-002'])->save();
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-LAP-001',
            'tag_number' => 'PF/ICT/DEMO1',
            'name' => 'Dell Latitude 5520',
            'category' => $category->code,
            'status' => 'active',
            'assigned_to' => $staff->id,
            'issued_at' => now()->subMonths(3),
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);

        $res = $http->getJson('/api/v1/assets/reports/assigned-to-user?user_id='.$staff->id.'&mode=current')
            ->assertOk();
        $this->assertCount(1, $res->json('data'));
        $this->assertSame('Dell Latitude 5520', $res->json('data.0.description'));
        $this->assertSame('inferred', $res->json('data.0.acknowledgement_status'));
    }

    public function test_governed_engine_runs_custody_reports_and_official_exports(): void
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
        $this->seedAssignedAsset($tenant, $category->code, $staff->id, 'Assigned laptop', 'assigned');
        $this->seedAssignedAsset($tenant, $category->code, $staff->id, 'Overdue projector', 'loan_out', now()->subDays(20), null, now()->subDays(2), 'temporary_loan');
        AssetAssignmentHistory::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $this->seedAssignedAsset($tenant, $category->code, $staff->id, 'Pending tablet', 'assigned')->id,
            'assigned_to' => $staff->id,
            'assignment_type' => 'assigned',
            'assigned_at' => now()->subDay(),
            'acknowledged_at' => null,
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'PF-UNASSIGNED',
            'tag_number' => '00123',
            'name' => '=HYPERLINK("http://evil","x")',
            'category' => $category->code,
            'status' => 'active',
            'assigned_to' => null,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);

        $r03 = $http->getJson('/api/v1/assets/reports/run?report_id=R03')->assertOk();
        $this->assertSame('R03', $r03->json('run.report_id'));
        $this->assertGreaterThanOrEqual(1, (int) $r03->json('totals.count'));

        $r04 = $http->getJson('/api/v1/assets/reports/run?report_id=R04')->assertOk();
        $tags = collect($r04->json('data'))->pluck('asset_tag')->all();
        $this->assertTrue(
            in_array('00123', $tags, true) || in_array('PF-UNASSIGNED', $tags, true),
            'R04 should include the unassigned active asset, got: '.implode(',', $tags),
        );

        $r05 = $http->getJson('/api/v1/assets/reports/run?report_id=R05')->assertOk();
        $this->assertGreaterThanOrEqual(1, (int) $r05->json('totals.count'));

        $r06 = $http->getJson('/api/v1/assets/reports/run?report_id=R06')->assertOk();
        $this->assertGreaterThanOrEqual(1, (int) $r06->json('totals.count'));

        $r09 = $http->getJson('/api/v1/assets/reports/run?report_id=R09&user_id='.$staff->id)->assertOk();
        $this->assertSame('Staff clearance', $r09->json('title'));
        $this->assertNotEmpty($r09->json('declaration'));

        $xlsx = $http->get('/api/v1/assets/reports/export?report_id=R04&format=xlsx&official=1')->assertOk();
        $this->assertStringContainsString('spreadsheetml', $xlsx->headers->get('content-type'));
        $tmp = tempnam(sys_get_temp_dir(), 'far');
        file_put_contents($tmp, $xlsx->streamedContent());
        $sheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($tmp);
        $this->assertSame('Report Info', $sheet->getSheet(0)->getTitle());
        $data = $sheet->getSheetByName('Data');
        $this->assertNotNull($data);
        $found = false;
        foreach ($data->toArray() as $row) {
            if (in_array("'=HYPERLINK(\"http://evil\",\"x\")", $row, true) || in_array('=HYPERLINK("http://evil","x")', $row, true)) {
                $found = true;
                $this->assertTrue(
                    str_starts_with((string) $row[1], "'=") || $data->getCell('B2')->getDataType() === 's',
                    'formula-like description must not be a formula',
                );
            }
            if (in_array('00123', $row, true)) {
                $found = true;
            }
        }
        $this->assertTrue($found);
        @unlink($tmp);

        $pdf = $http->get('/api/v1/assets/reports/export?report_id=R02&format=pdf&official=1&user_id='.$staff->id)->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->streamedContent());
        $this->assertNotEmpty($pdf->headers->get('X-Report-Checksum'));
        $this->assertDatabaseHas('audit_logs', ['event' => 'assets.report.exported']);
    }

    public function test_inventory_must_reports_separate_capital_and_controlled(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);
        $hq = AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'HQ-IT',
            'name' => 'Headquarters ICT',
            'building' => 'HQ',
            'floor' => '2',
            'room' => '214',
            'is_active' => true,
        ]);
        $capital = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CAP-001',
            'tag_number' => 'CAP-001',
            'name' => 'Capital server',
            'category' => $category->code,
            'asset_class' => 'capital',
            'status' => 'active',
            'location_id' => $hq->id,
            'department' => 'ICT',
            'purchase_date' => now()->subDays(10),
            'purchase_value' => 50000,
            'book_value' => 40000,
            'funding_source' => 'core',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetLocationHistory::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $capital->id,
            'location_id' => $hq->id,
            'location_label' => 'Headquarters ICT',
            'moved_at' => now()->subDays(3),
            'notes' => 'Commissioned',
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CTL-001',
            'tag_number' => null,
            'name' => 'Controlled tablet',
            'category' => $category->code,
            'asset_class' => 'controlled',
            'status' => 'active',
            'donor_name' => 'EU',
            'funding_source' => 'grant',
            'ownership_type' => 'donated',
            'purchase_date' => now()->subDays(5),
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetTransfer::create([
            'tenant_id' => $tenant->id,
            'asset_id' => Asset::query()->where('asset_code', 'CAP-001')->value('id'),
            'from_user_id' => $this->makeUser('staff', $tenant)->id,
            'to_user_id' => $this->makeUser('staff', $tenant)->id,
            'status' => 'pending_incoming',
            'reason' => 'Office move',
        ]);

        $r11 = $http->getJson('/api/v1/assets/reports/run?report_id=R11')->assertOk();
        $this->assertSame('Master fixed asset register', $r11->json('title'));
        $this->assertContains('CAP-001', collect($r11->json('data'))->pluck('asset_tag')->all());
        $this->assertNotContains('CTL-001', collect($r11->json('data'))->pluck('asset_tag')->all());

        $r12 = $http->getJson('/api/v1/assets/reports/run?report_id=R12')->assertOk();
        $this->assertContains('CTL-001', collect($r12->json('data'))->pluck('asset_tag')->all());

        $r13 = $http->getJson('/api/v1/assets/reports/run?report_id=R13')->assertOk();
        $this->assertContains('CAP-001', collect($r13->json('data'))->pluck('asset_tag')->all());
        $this->assertSame('Headquarters ICT', collect($r13->json('data'))->firstWhere('asset_tag', 'CAP-001')['site']);

        $r14 = $http->getJson('/api/v1/assets/reports/run?report_id=R14')->assertOk();
        $this->assertGreaterThanOrEqual(1, (int) $r14->json('totals.classes'));
        $this->assertContains('purchase_value', collect($r14->json('columns'))->pluck('key')->all());

        $r15 = $http->getJson('/api/v1/assets/reports/run?report_id=R15')->assertOk();
        $this->assertGreaterThanOrEqual(2, (int) $r15->json('totals.count'));

        $r16 = $http->getJson('/api/v1/assets/reports/run?report_id=R16')->assertOk();
        $this->assertGreaterThanOrEqual(1, (int) $r16->json('totals.count'));

        $r17 = $http->getJson('/api/v1/assets/reports/run?report_id=R17&from='.now()->subMonth()->toDateString())->assertOk();
        $this->assertGreaterThanOrEqual(2, (int) $r17->json('totals.count'));

        $r18 = $http->getJson('/api/v1/assets/reports/run?report_id=R18')->assertOk();
        $this->assertContains('CTL-001', collect($r18->json('data'))->pluck('asset_tag')->all());

        $r19 = $http->getJson('/api/v1/assets/reports/run?report_id=R19')->assertOk();
        $this->assertContains('CTL-001', collect($r19->json('data'))->pluck('asset_tag')->all());

        $xlsx = $http->get('/api/v1/assets/reports/export?report_id=R11&format=xlsx&official=1')->assertOk();
        $this->assertStringContainsString('spreadsheetml', (string) $xlsx->headers->get('content-type'));
    }

    public function test_finance_must_reports_schedule_exceptions_and_hide_from_non_finance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $admin->givePermissionTo('assets.financials.view');
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);
        $scheduled = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'DEP-001',
            'tag_number' => 'DEP-001',
            'name' => 'Capital server',
            'category' => $category->code,
            'asset_class' => 'capital',
            'status' => 'active',
            'purchase_date' => now()->subYears(2),
            'capitalisation_date' => now()->subYears(2),
            'purchase_value' => 48000,
            'salvage_value' => 0,
            'useful_life_years' => 4,
            'depreciation_method' => 'straight_line',
            'accumulated_depreciation' => 24000,
            'book_value' => 24000,
            'funding_source' => 'core',
            'invoice_number' => 'INV-100',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        $run = AssetDepreciationRun::create([
            'tenant_id' => $tenant->id,
            'run_date' => now()->toDateString(),
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
            'status' => 'completed',
            'run_by' => $admin->id,
            'asset_count' => 1,
            'total_depreciation' => 1000,
        ]);
        AssetDepreciationRunLine::create([
            'run_id' => $run->id,
            'asset_id' => $scheduled->id,
            'opening_book_value' => 25000,
            'depreciation_amount' => 1000,
            'closing_book_value' => 24000,
            'accumulated_depreciation' => 24000,
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'DEP-ZERO',
            'tag_number' => 'DEP-ZERO',
            'name' => 'Zero NBV laptop',
            'category' => $category->code,
            'asset_class' => 'capital',
            'status' => 'active',
            'purchase_date' => now()->subYears(5),
            'purchase_value' => 8000,
            'salvage_value' => 0,
            'useful_life_years' => 4,
            'book_value' => 0,
            'accumulated_depreciation' => 8000,
            'funding_source' => 'core',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'DEP-ADD',
            'tag_number' => 'DEP-ADD',
            'name' => 'Unmatched acquisition',
            'category' => $category->code,
            'asset_class' => 'capital',
            'status' => 'active',
            'purchase_date' => now()->subDays(8),
            'purchase_value' => 15000,
            'funding_source' => 'grant',
            'donor_name' => 'EU',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'DEP-NEG',
            'tag_number' => 'DEP-NEG',
            'name' => 'Negative NBV printer',
            'category' => $category->code,
            'asset_class' => 'capital',
            'status' => 'active',
            'purchase_date' => now()->subYears(1),
            'purchase_value' => 3000,
            'book_value' => -50,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'DEP-OUT',
            'tag_number' => 'DEP-OUT',
            'name' => 'Disposed still valued',
            'category' => $category->code,
            'asset_class' => 'capital',
            'status' => 'disposed',
            'purchase_date' => now()->subYears(3),
            'purchase_value' => 9000,
            'book_value' => 1200,
            'useful_life_years' => 4,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);

        $r21 = $http->getJson('/api/v1/assets/reports/run?report_id=R21')->assertOk();
        $this->assertSame('Depreciation schedule', $r21->json('title'));
        $this->assertContains('DEP-001', collect($r21->json('data'))->pluck('asset_tag')->all());
        $this->assertEquals(1000, (float) collect($r21->json('data'))->firstWhere('asset_tag', 'DEP-001')['depreciation_charge']);

        $r22 = $http->getJson('/api/v1/assets/reports/run?report_id=R22')->assertOk();
        $this->assertGreaterThanOrEqual(1, (int) $r22->json('totals.classes'));

        $r23 = $http->getJson('/api/v1/assets/reports/run?report_id=R23')->assertOk();
        $this->assertContains('DEP-ZERO', collect($r23->json('data'))->pluck('asset_tag')->all());

        $r25 = $http->getJson('/api/v1/assets/reports/run?report_id=R25&from='.now()->subMonth()->toDateString())->assertOk();
        $this->assertContains('DEP-ADD', collect($r25->json('data'))->pluck('asset_tag')->all());
        $this->assertContains('unmatched_procurement', collect($r25->json('exceptions'))->pluck('exception_reason')->all());

        $r27 = $http->getJson('/api/v1/assets/reports/run?report_id=R27')->assertOk();
        $reasons = collect($r27->json('data'))->pluck('exception_reason')->all();
        $this->assertContains('negative_nbv', $reasons);
        $this->assertContains('disposed_but_depreciating', $reasons);
        $this->assertContains('missing_useful_life', $reasons);
        $this->assertContains('unposted_batch', $reasons);

        $r29 = $http->getJson('/api/v1/assets/reports/run?report_id=R29')->assertOk();
        $this->assertContains('grant', collect($r29->json('data'))->pluck('funding_source')->all());
        $this->assertContains('core', collect($r29->json('data'))->pluck('funding_source')->all());

        $xlsx = $http->get('/api/v1/assets/reports/export?report_id=R21&format=xlsx&official=1')->assertOk();
        $this->assertStringContainsString('spreadsheetml', (string) $xlsx->headers->get('content-type'));

        $viewer = $this->makeUser('staff', $tenant);
        $viewer->givePermissionTo('assets.view');
        $this->asUser($viewer)->getJson('/api/v1/assets/reports/run?report_id=R21')->assertForbidden();
    }

    public function test_verification_must_reports_cover_campaign_exceptions_and_sign_off(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $admin->givePermissionTo('assets.financials.view');
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);
        $missing = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'VF-MISS',
            'tag_number' => 'VF-MISS',
            'name' => 'Missing projector',
            'category' => $category->code,
            'status' => 'active',
            'purchase_value' => 9000,
            'book_value' => 4500,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        $relocated = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'VF-LOC',
            'tag_number' => 'VF-LOC',
            'name' => 'Relocated desktop',
            'category' => $category->code,
            'status' => 'active',
            'purchase_value' => 7000,
            'book_value' => 3000,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        $custodian = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'VF-CUS',
            'tag_number' => 'VF-CUS',
            'name' => 'Wrong custodian laptop',
            'category' => $category->code,
            'status' => 'active',
            'purchase_value' => 12000,
            'book_value' => 8000,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        $ok = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'VF-OK',
            'tag_number' => 'VF-OK',
            'name' => 'Verified monitor',
            'category' => $category->code,
            'status' => 'active',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        $campaign = AssetVerificationCampaign::create([
            'tenant_id' => $tenant->id,
            'name' => '2026 HQ stocktake',
            'status' => 'open',
            'starts_on' => now()->subDays(5)->toDateString(),
            'created_by' => $admin->id,
        ]);
        AssetVerificationResult::create([
            'campaign_id' => $campaign->id,
            'asset_id' => $missing->id,
            'result' => 'missing',
            'verified_by' => $admin->id,
            'verified_at' => now(),
            'notes' => 'Not in room 214',
        ]);
        AssetVerificationResult::create([
            'campaign_id' => $campaign->id,
            'asset_id' => $relocated->id,
            'result' => 'wrong_location',
            'verified_by' => $admin->id,
            'verified_at' => now(),
            'notes' => 'Found in stores',
            'mismatch_types' => ['location'],
        ]);
        AssetVerificationResult::create([
            'campaign_id' => $campaign->id,
            'asset_id' => $custodian->id,
            'result' => 'wrong_custodian',
            'verified_by' => $admin->id,
            'verified_at' => now(),
            'notes' => 'Held by another officer',
        ]);
        AssetVerificationResult::create([
            'campaign_id' => $campaign->id,
            'asset_id' => $ok->id,
            'result' => 'verified',
            'verified_by' => $admin->id,
            'verified_at' => now(),
        ]);
        AssetUnregisteredFind::create([
            'tenant_id' => $tenant->id,
            'campaign_id' => $campaign->id,
            'status' => 'open',
            'description' => 'Unlabelled tablet',
            'serial_number' => 'SN-FOUND-1',
            'found_location' => 'Boardroom',
            'found_by' => $admin->id,
            'found_at' => now(),
        ]);

        $r31 = $http->getJson('/api/v1/assets/reports/run?report_id=R31')->assertOk();
        $this->assertSame('Campaign progress', $r31->json('title'));
        $this->assertContains('2026 HQ stocktake', collect($r31->json('data'))->pluck('campaign')->all());

        $r32 = $http->getJson('/api/v1/assets/reports/run?report_id=R32&campaign_id='.$campaign->id)->assertOk();
        $this->assertContains('VF-MISS', collect($r32->json('data'))->pluck('asset_tag')->all());

        $r33 = $http->getJson('/api/v1/assets/reports/run?report_id=R33&campaign_id='.$campaign->id)->assertOk();
        $this->assertContains('SN-FOUND-1', collect($r33->json('data'))->pluck('serial_number')->all());

        $r34 = $http->getJson('/api/v1/assets/reports/run?report_id=R34&campaign_id='.$campaign->id)->assertOk();
        $this->assertContains('VF-LOC', collect($r34->json('data'))->pluck('asset_tag')->all());

        $r35 = $http->getJson('/api/v1/assets/reports/run?report_id=R35&campaign_id='.$campaign->id)->assertOk();
        $this->assertContains('VF-CUS', collect($r35->json('data'))->pluck('asset_tag')->all());

        $r37 = $http->getJson('/api/v1/assets/reports/run?report_id=R37&campaign_id='.$campaign->id)->assertOk();
        $this->assertGreaterThanOrEqual(3, (int) $r37->json('totals.count'));
        $this->assertStringStartsWith('VX-', (string) collect($r37->json('data'))->pluck('exception_id')->first());

        $r38 = $http->getJson('/api/v1/assets/reports/run?report_id=R38&campaign_id='.$campaign->id)->assertOk();
        $this->assertSame('Verification sign-off pack', $r38->json('title'));
        $this->assertNotEmpty($r38->json('declaration'));
        $this->assertGreaterThanOrEqual(1, (int) $r38->json('totals.unresolved'));

        $xlsx = $http->get('/api/v1/assets/reports/export?report_id=R38&format=xlsx&official=1&campaign_id='.$campaign->id)->assertOk();
        $this->assertStringContainsString('spreadsheetml', (string) $xlsx->headers->get('content-type'));
    }

    public function test_lifecycle_must_reports_cover_service_disposal_risk_and_audit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);
        $repair = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'LC-REP',
            'tag_number' => 'LC-REP',
            'name' => 'Printer under repair',
            'category' => $category->code,
            'status' => 'under_repair',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetMaintenanceRecord::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $repair->id,
            'maintenance_type' => 'corrective',
            'status' => 'open',
            'title' => 'Replace fuser',
            'scheduled_on' => now()->subDays(3)->toDateString(),
            'recorded_by' => $admin->id,
        ]);
        $candidate = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'LC-OLD',
            'tag_number' => 'LC-OLD',
            'name' => 'Obsolete desktop',
            'category' => $category->code,
            'status' => 'active',
            'condition' => 'obsolete',
            'book_value' => 0,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetDisposal::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $candidate->id,
            'reference' => 'DISP-TEST1',
            'status' => 'recommended',
            'reason' => 'obsolete',
            'justification' => 'Beyond economic repair',
            'requested_by' => $admin->id,
        ]);
        $written = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'LC-OFF',
            'tag_number' => 'LC-OFF',
            'name' => 'Written off scanner',
            'category' => $category->code,
            'status' => 'written_off',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetDisposal::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $written->id,
            'reference' => 'DISP-TEST2',
            'status' => 'completed',
            'reason' => 'damaged',
            'method' => 'write_off',
            'justification' => 'Destroyed',
            'requested_by' => $admin->id,
            'completed_at' => now(),
        ]);
        $stolen = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'LC-STL',
            'tag_number' => 'LC-STL',
            'name' => 'Stolen laptop',
            'category' => $category->code,
            'status' => 'stolen',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetIncident::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $stolen->id,
            'type' => 'stolen',
            'status' => 'open',
            'date_noticed' => now()->toDateString(),
            'recorded_by' => $admin->id,
            'circumstances' => 'Office break-in',
        ]);

        $r40 = $http->getJson('/api/v1/assets/reports/run?report_id=R40')->assertOk();
        $this->assertSame('Service due and overdue', $r40->json('title'));
        $this->assertContains('LC-REP', collect($r40->json('data'))->pluck('asset_tag')->all());

        $r43 = $http->getJson('/api/v1/assets/reports/run?report_id=R43')->assertOk();
        $this->assertContains('LC-REP', collect($r43->json('data'))->pluck('asset_tag')->all());

        $r44 = $http->getJson('/api/v1/assets/reports/run?report_id=R44')->assertOk();
        $this->assertContains('LC-OLD', collect($r44->json('data'))->pluck('asset_tag')->all());

        $r45 = $http->getJson('/api/v1/assets/reports/run?report_id=R45')->assertOk();
        $this->assertContains('DISP-TEST1', collect($r45->json('data'))->pluck('reference')->all());

        $r46 = $http->getJson('/api/v1/assets/reports/run?report_id=R46')->assertOk();
        $this->assertContains('LC-OFF', collect($r46->json('data'))->pluck('asset_tag')->all());

        $r48 = $http->getJson('/api/v1/assets/reports/run?report_id=R48')->assertOk();
        $this->assertContains('LC-STL', collect($r48->json('data'))->pluck('asset_tag')->all());

        $r50 = $http->getJson('/api/v1/assets/reports/run?report_id=R50')->assertOk();
        $this->assertSame('Executive asset dashboard', $r50->json('title'));
        $this->assertGreaterThanOrEqual(6, count($r50->json('data')));

        $r52 = $http->getJson('/api/v1/assets/reports/run?report_id=R52')->assertOk();
        $this->assertSame('Asset audit trail and data-quality exceptions', $r52->json('title'));
        $this->assertNotEmpty($r52->json('declaration'));

        $xlsx = $http->get('/api/v1/assets/reports/export?report_id=R50&format=xlsx&official=1')->assertOk();
        $this->assertStringContainsString('spreadsheetml', (string) $xlsx->headers->get('content-type'));
    }

    public function test_should_reports_cover_returns_components_warranty_and_forecast(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 4,
        ]);
        $this->seedAssignedAsset($tenant, $category->code, $staff->id, 'Returned dock', 'available', now()->subDays(20), now()->subDay());
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'SH-POOL',
            'tag_number' => 'SH-POOL',
            'name' => 'Pool projector',
            'category' => $category->code,
            'status' => 'active',
            'custodian_type' => 'pool',
            'department' => 'ICT',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        $parent = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KIT-1',
            'tag_number' => 'KIT-1',
            'name' => 'Conference kit',
            'category' => $category->code,
            'status' => 'active',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KIT-1A',
            'tag_number' => 'KIT-1A',
            'name' => 'Kit microphone',
            'category' => $category->code,
            'status' => 'active',
            'parent_asset_id' => $parent->id,
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        $worn = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'WR-1',
            'tag_number' => 'WR-1',
            'name' => 'Warranty laptop',
            'category' => $category->code,
            'status' => 'active',
            'warranty_expiry' => now()->addDays(10),
            'warranty_provider' => 'Dell',
            'useful_life_years' => 4,
            'purchase_date' => now()->subYears(3),
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ]);
        AssetMaintenanceRecord::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $worn->id,
            'maintenance_type' => 'corrective',
            'status' => 'completed',
            'title' => 'Keyboard',
            'cost' => 3000,
            'completed_on' => now()->subMonth()->toDateString(),
            'recorded_by' => $admin->id,
        ]);
        AssetMaintenanceRecord::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $worn->id,
            'maintenance_type' => 'corrective',
            'status' => 'completed',
            'title' => 'Screen',
            'cost' => 4000,
            'completed_on' => now()->subWeek()->toDateString(),
            'recorded_by' => $admin->id,
        ]);
        $campaign = AssetVerificationCampaign::create([
            'tenant_id' => $tenant->id,
            'name' => 'Condition sweep',
            'status' => 'open',
            'starts_on' => now()->toDateString(),
            'created_by' => $admin->id,
        ]);
        AssetVerificationResult::create([
            'campaign_id' => $campaign->id,
            'asset_id' => $worn->id,
            'result' => 'condition_changed',
            'condition' => 'poor',
            'verified_by' => $admin->id,
            'verified_at' => now(),
        ]);
        AssetDisposal::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $parent->id,
            'reference' => 'DISP-VAL-1',
            'status' => 'approved',
            'reason' => 'surplus',
            'method' => 'sale',
            'justification' => 'Kit surplus',
            'estimated_value' => 2500,
            'proceeds' => 1800,
            'requested_by' => $admin->id,
        ]);
        AssetInsurancePolicy::create([
            'tenant_id' => $tenant->id,
            'policy_number' => 'POL-1',
            'insurer_name' => 'Santam',
            'coverage_type' => 'all_risk',
            'effective_from' => now()->subYear()->toDateString(),
            'effective_to' => now()->addYear()->toDateString(),
            'status' => 'active',
            'asset_id' => $worn->id,
            'sum_insured' => 20000,
            'created_by' => $admin->id,
        ]);

        $r07 = $http->getJson('/api/v1/assets/reports/run?report_id=R07')->assertOk();
        $this->assertSame('Returned assets', $r07->json('title'));
        $this->assertGreaterThanOrEqual(1, (int) $r07->json('totals.count'));

        $r10 = $http->getJson('/api/v1/assets/reports/run?report_id=R10')->assertOk();
        $this->assertContains('SH-POOL', collect($r10->json('data'))->pluck('asset_tag')->all());

        $r20 = $http->getJson('/api/v1/assets/reports/run?report_id=R20')->assertOk();
        $this->assertContains('KIT-1', collect($r20->json('data'))->pluck('asset_tag')->all());
        $this->assertContains('KIT-1A', collect($r20->json('data'))->pluck('asset_tag')->all());

        $r36 = $http->getJson('/api/v1/assets/reports/run?report_id=R36')->assertOk();
        $this->assertContains('WR-1', collect($r36->json('data'))->pluck('asset_tag')->all());

        $r39 = $http->getJson('/api/v1/assets/reports/run?report_id=R39')->assertOk();
        $this->assertContains('WR-1', collect($r39->json('data'))->pluck('asset_tag')->all());

        $r41 = $http->getJson('/api/v1/assets/reports/run?report_id=R41')->assertOk();
        $this->assertGreaterThanOrEqual(2, (int) $r41->json('totals.count'));

        $r42 = $http->getJson('/api/v1/assets/reports/run?report_id=R42')->assertOk();
        $this->assertContains('WR-1', collect($r42->json('data'))->pluck('asset_tag')->all());

        $r47 = $http->getJson('/api/v1/assets/reports/run?report_id=R47')->assertOk();
        $this->assertContains('DISP-VAL-1', collect($r47->json('data'))->pluck('reference')->all());

        $r49 = $http->getJson('/api/v1/assets/reports/run?report_id=R49')->assertOk();
        $this->assertContains('POL-1', collect($r49->json('data'))->pluck('policy_number')->all());

        $r51 = $http->getJson('/api/v1/assets/reports/run?report_id=R51')->assertOk();
        $this->assertContains('WR-1', collect($r51->json('data'))->pluck('asset_tag')->all());
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
