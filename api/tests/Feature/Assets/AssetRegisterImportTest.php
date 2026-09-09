<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetImportBatch;
use App\Models\AssetImportLineage;
use App\Models\AssetImportRaw;
use App\Models\AssetQrToken;
use App\Models\Tenant;
use App\Modules\Assets\Services\AssetImportCommitService;
use App\Modules\Assets\Services\AssetQrService;
use App\Modules\Assets\Services\AssetReconciliationReportService;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class AssetRegisterImportTest extends TestCase
{
    private function fixture(string $name): string
    {
        return base_path('tests/Fixtures/asset-register/'.$name);
    }

    private function uploaded(string $path, string $as): UploadedFile
    {
        return new UploadedFile($path, $as, null, null, true);
    }

    public function test_staff_cannot_import_or_see_import_api(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/assets/import')->assertForbidden();
        $http->get('/api/v1/assets/import/template')->assertForbidden();
        $http->post('/api/v1/assets/import', [])->assertForbidden();
    }

    public function test_admin_can_download_excel_import_template(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $res = $http->get('/api/v1/assets/import/template');
        $res->assertOk();
        $res->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringContainsString('sadcpf-asset-import-template.xlsx', (string) $res->headers->get('content-disposition'));

        $body = (string) $res->getContent();
        $this->assertSame("PK\x03\x04", substr($body, 0, 4));

        $path = sys_get_temp_dir().'/downloaded-asset-template-'.uniqid().'.xlsx';
        file_put_contents($path, $body);
        $rows = (new \App\Modules\Assets\Import\NexusAssetTemplateParser)->parseFile($path, 'sadcpf-asset-import-template.xlsx');
        unlink($path);

        $this->assertSame([], $rows);
        $this->assertContains('asset_tag', \App\Modules\Assets\Import\NexusAssetTemplateParser::HEADERS);
        $this->assertContains('asset_name', \App\Modules\Assets\Import\NexusAssetTemplateParser::HEADERS);
        $this->assertContains('original_cost', \App\Modules\Assets\Import\NexusAssetTemplateParser::HEADERS);
        $this->assertContains('assigned_to_email', \App\Modules\Assets\Import\NexusAssetTemplateParser::HEADERS);
    }

    public function test_template_assigned_to_email_optionally_resolves_tenant_user(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $path = sys_get_temp_dir().'/template-assign-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'assigned_to_email'],
            ['CE-5101', 'Matched laptop', $staff->email],
            ['CE-5102', 'Unknown custodian', 'nobody-at-sadcpf@example.test'],
            ['CE-5103', 'Unassigned laptop', ''],
        ]);
        (new Xlsx($sheet))->save($path);

        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        unlink($path);

        $batch = AssetImportBatch::find($res->json('data.batch.id'));
        $matched = $batch->stagingRows()->where('asset_tag', 'CE-5101')->first();
        $unknown = $batch->stagingRows()->where('asset_tag', 'CE-5102')->first();
        $blank = $batch->stagingRows()->where('asset_tag', 'CE-5103')->first();

        $this->assertNotNull($matched);
        $this->assertSame($staff->id, (int) $matched->custodian_user_id);
        $this->assertSame('user', $matched->custodian_type);

        $this->assertNull($unknown->custodian_user_id);
        $this->assertContains('ASSIGNED_USER_UNMATCHED', $unknown->data_quality_flags ?? []);
        $this->assertNotContains('ASSIGNED_USER_UNMATCHED', $blank->data_quality_flags ?? []);
        $this->assertNull($blank->custodian_user_id);

        $http->postJson("/api/v1/assets/import/{$batch->id}/commit", ['approve_non_blocking' => true])->assertOk();

        $asset = Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'CE-5101')->first();
        $this->assertNotNull($asset);
        $this->assertSame($staff->id, (int) $asset->assigned_to);
        $this->assertDatabaseHas('asset_assignment_histories', [
            'asset_id' => $asset->id,
            'assigned_to' => $staff->id,
            'returned_at' => null,
        ]);

        $unassigned = Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'CE-5103')->first();
        $this->assertNull($unassigned?->assigned_to);
    }

    public function test_map_custodian_to_user_assigns_on_commit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $path = sys_get_temp_dir().'/template-map-user-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'custodian_candidate'],
            ['CE-5201', 'Mapped to person', 'Jane Officer'],
        ]);
        (new Xlsx($sheet))->save($path);

        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        $batchId = $res->json('data.batch.id');
        unlink($path);

        $http->postJson("/api/v1/assets/import/{$batchId}/map-custodian", [
            'legacy_key' => 'Jane Officer',
            'custodian_type' => 'user',
            'user_id' => $staff->id,
        ])->assertOk();

        $this->assertDatabaseHas('asset_import_staging', [
            'import_batch_id' => $batchId,
            'asset_tag' => 'CE-5201',
            'custodian_type' => 'user',
            'custodian_user_id' => $staff->id,
        ]);

        $http->postJson("/api/v1/assets/import/{$batchId}/commit", ['approve_non_blocking' => true])->assertOk();
        $asset = Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'CE-5201')->first();
        $this->assertSame($staff->id, (int) $asset->assigned_to);
        $this->assertDatabaseHas('asset_assignment_histories', [
            'asset_id' => $asset->id,
            'assigned_to' => $staff->id,
        ]);
    }

    public function test_template_xlsx_carries_cost_and_skips_blank_rows(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $path = sys_get_temp_dir().'/template-cost-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'serial_number', 'legacy_category', 'original_cost', 'current_book_value', 'legacy_location', 'acquisition_date'],
            ['CE-4101', 'Bulk laptop', 'SN-4101', 'Computer Equipment', 12500.5, 9800, 'Head Office', '2024-03-01'],
            ['', '', '', '', '', '', '', ''],
        ]);
        (new Xlsx($sheet))->save($path);

        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        unlink($path);

        $this->assertSame(1, (int) $res->json('data.counts.unique_asset_tags'));
        $row = AssetImportBatch::find($res->json('data.batch.id'))->stagingRows()->where('asset_tag', 'CE-4101')->first();
        $this->assertNotNull($row);
        $this->assertEqualsWithDelta(12500.5, (float) $row->original_cost, 0.01);
        $this->assertEqualsWithDelta(9800, (float) $row->current_book_value, 0.01);
        $this->assertSame('2024-03-01', optional($row->acquisition_date)?->toDateString() ?? $row->acquisition_date);
        $this->assertSame('Head Office', $row->legacy_location);
    }

    public function test_legacy_ingest_commit_qr_and_identity_equation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $response = $http->post('/api/v1/assets/import', [
            'mode' => 'legacy',
            'category' => $this->uploaded($this->fixture('2036_Fixed_Assets_Listing_Category_31_March_2026.xls'), 'category.xls'),
            'location' => $this->uploaded($this->fixture('2026_Fixed_Assets_Listing_Location_31_March_2026.xls'), 'location.xls'),
            'staging' => $this->uploaded($this->fixture('Nexus_Asset_Register_Import_Staging.xlsx'), 'staging.xlsx'),
        ]);
        $response->assertCreated();
        $batchId = $response->json('data.batch.id');
        $this->assertNotNull($batchId);
        $this->assertSame(323, (int) $response->json('data.counts.unique_asset_tags'));
        $this->assertSame(0, (int) $response->json('data.counts.blocking_errors'));
        $this->assertContains('FF-0172', AssetImportBatch::find($batchId)->stagingRows()->pluck('asset_tag')->all());
        $ff0208 = AssetImportBatch::find($batchId)->stagingRows()->where('asset_tag', 'FF-0208')->first();
        $this->assertNotNull($ff0208);
        $this->assertNotEmpty($ff0208->legacy_location);

        $ce = AssetImportBatch::find($batchId)->stagingRows()->where('asset_tag', 'CE-0092')->first();
        $this->assertNotNull($ce);
        $this->assertEqualsWithDelta(22434.78, (float) $ce->original_cost, 0.01);
        $this->assertEqualsWithDelta(17760.88, (float) $ce->current_book_value, 0.01);
        $this->assertSame('NAD', $ce->currency);

        $as = AssetImportBatch::find($batchId)->stagingRows()->where('asset_tag', 'AS-0001')->first();
        $this->assertSame('active', $as->status);
        $this->assertSame('held_for_sale', $as->category_code);

        $raw = AssetImportRaw::query()->where('import_batch_id', $batchId)->first();
        $this->assertFalse($raw->update(['source_filename' => 'tampered.xls']));
        $raw->refresh();
        $this->assertNotSame('tampered.xls', $raw->source_filename);

        $retry = $http->post('/api/v1/assets/import', [
            'mode' => 'legacy',
            'category' => $this->uploaded($this->fixture('2036_Fixed_Assets_Listing_Category_31_March_2026.xls'), 'category.xls'),
            'location' => $this->uploaded($this->fixture('2026_Fixed_Assets_Listing_Location_31_March_2026.xls'), 'location.xls'),
            'staging' => $this->uploaded($this->fixture('Nexus_Asset_Register_Import_Staging.xlsx'), 'staging.xlsx'),
        ]);
        $retry->assertCreated();
        $this->assertSame($batchId, $retry->json('data.batch.id'));
        $this->assertSame(1, AssetImportBatch::query()->where('tenant_id', $tenant->id)->count());

        $commit = $http->postJson("/api/v1/assets/import/{$batchId}/commit", ['approve_non_blocking' => true]);
        $commit->assertOk();
        $this->assertTrue($commit->json('data.equation.balanced'));
        $this->assertSame('committed', AssetImportBatch::find($batchId)->status);
        $this->assertSame(323, (int) $commit->json('data.equation.unique_source_tags'));
        $this->assertSame(323, (int) $commit->json('data.equation.unique_source_tags'));
        $this->assertSame(323, (int) $commit->json('data.equation.created') + (int) $commit->json('data.equation.matched_existing') + (int) $commit->json('data.equation.approved_exclusions') + (int) $commit->json('data.equation.outstanding_exceptions'));
        $this->assertSame(323, Asset::query()->where('tenant_id', $tenant->id)->count());

        $asset = Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'CE-0092')->first();
        $this->assertNotNull($asset);
        $this->assertSame('CE-0092', $asset->asset_code);
        $this->assertNotEquals('CE-0092', $asset->qr_token);
        $this->assertDoesNotMatchRegularExpression('/CE-0092/', $asset->qr_token);
        $this->assertStringContainsString('/a/'.$asset->qr_token, $asset->qr_url);

        $public = $this->getJson('/api/v1/public/assets/'.$asset->qr_token);
        $public->assertOk();
        $payload = $public->json('data');
        $this->assertSame('CE-0092', $payload['asset_tag']);
        $this->assertArrayNotHasKey('serial_number', $payload);
        $this->assertArrayNotHasKey('book_value', $payload);
        $this->assertArrayNotHasKey('custodian', $payload);

        $this->assertSame(323, AssetQrToken::query()->where('tenant_id', $tenant->id)->whereNull('revoked_at')->count());
        $this->assertSame(
            323,
            AssetQrToken::query()->where('tenant_id', $tenant->id)->whereNull('revoked_at')->pluck('token')->unique()->count()
        );

        $report = app(AssetReconciliationReportService::class)->build(AssetImportBatch::find($batchId));
        $this->assertTrue($report['equation']['balanced']);
        $this->assertSame('COMPLETE', $report['status']);
        $path = app(AssetReconciliationReportService::class)->writeMarkdown($report);
        $this->assertFileExists($path);
        $this->assertStringContainsString('323 unique source tags', file_get_contents($path));
    }

    public function test_template_xlsx_duplicate_tag_and_missing_tag(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $path = sys_get_temp_dir().'/template-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'serial_number', 'legacy_category'],
            ['CE-2001', 'Laptop A', 'SN-A', 'Computer Equipment'],
            ['CE-2001', 'Laptop dup', 'SN-B', 'Computer Equipment'],
            ['', 'No tag', 'SN-C', 'Computer Equipment'],
        ]);
        (new Xlsx($sheet))->save($path);

        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        $this->assertGreaterThan(0, (int) $res->json('data.counts.duplicate_asset_tags') + (int) $res->json('data.counts.blocking_errors'));
        unlink($path);
    }

    public function test_staff_cannot_see_financials_on_authenticated_qr_lookup(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp, $admin] = $this->asAdmin($tenant);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-QR-1',
            'tag_number' => 'CE-7777',
            'name' => 'Hidden value laptop',
            'category' => 'it',
            'status' => 'active',
            'serial_number' => 'SECRET-SERIAL',
            'purchase_value' => 9999,
            'book_value' => 5000,
        ]);
        $asset = app(AssetQrService::class)->ensure($asset, $admin);

        [$viewer] = $this->asProcurementOfficer($tenant);
        $viewer->getJson('/api/v1/assets/qr/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonPath('data.serial_number', 'SECRET-SERIAL')
            ->assertJsonPath('data.purchase_value', null)
            ->assertJsonPath('data.book_value', null);

        [$adminHttp] = $this->asAdmin($tenant);
        $adminHttp->getJson('/api/v1/assets/qr/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonPath('data.purchase_value', '9999.00');

        $this->getJson('/api/v1/public/assets/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonMissingPath('data.serial_number')
            ->assertJsonMissingPath('data.purchase_value');
    }

    public function test_label_print_and_reprint_audit_requires_print_permission(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-8888',
            'tag_number' => 'CE-8888',
            'name' => 'Very long asset name that should still print on an Avery label without overflowing the register',
            'category' => 'it',
            'status' => 'active',
        ]);
        app(AssetQrService::class)->ensure($asset, $user);
        app(AssetImportCommitService::class)->seedDefaultTemplates($tenant->id);
        $template = \App\Models\AssetLabelTemplate::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', 'avery_l7161_permanent')
            ->first();

        [$staff] = $this->asStaff($tenant);
        $staff->postJson('/api/v1/assets/labels/print', [
            'asset_ids' => [$asset->id],
            'template_id' => $template->id,
            'json' => true,
        ])->assertForbidden();

        $this->asUser($user);
        $print = $http->postJson('/api/v1/assets/labels/print', [
            'asset_ids' => [$asset->id],
            'template_id' => $template->id,
            'json' => true,
        ]);
        $print->assertCreated();
        $this->assertDatabaseHas('asset_label_batches', ['tenant_id' => $tenant->id]);
        $asset->refresh();
        $this->assertSame('printed', $asset->label_status);

        app(\App\Modules\Assets\Services\AssetService::class)->setLocation(
            $asset,
            \App\Models\AssetLocation::create([
                'tenant_id' => $tenant->id,
                'code' => 'ho_room',
                'name' => 'Office 16C',
                'location_type' => 'office',
                'is_active' => true,
            ])->id,
            $user,
            'Moved'
        );
        $asset->refresh();
        $this->assertSame('reprint_required', $asset->label_status);
    }

    public function test_unregistered_find_is_not_an_asset_until_promoted(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $res = $http->postJson('/api/v1/assets/unregistered-finds', [
            'description' => 'Unlabelled projector in boardroom',
        ]);
        $res->assertCreated();
        $this->assertSame(0, Asset::query()->where('tenant_id', $tenant->id)->count());
        $id = $res->json('data.id');
        $http->postJson("/api/v1/assets/unregistered-finds/{$id}/promote", [
            'asset_tag' => 'OE-9999',
            'name' => 'Boardroom projector',
        ])->assertOk();
        $this->assertDatabaseHas('assets', ['tenant_id' => $tenant->id, 'tag_number' => 'OE-9999']);
    }

    public function test_revoked_qr_token_is_not_public(): void
    {
        $tenant = Tenant::factory()->create();
        [, $admin] = $this->asAdmin($tenant);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-5555',
            'tag_number' => 'CE-5555',
            'name' => 'Token rotate',
            'category' => 'it',
            'status' => 'active',
        ]);
        $first = app(AssetQrService::class)->generate($asset, $admin);
        $old = $first->qr_token;
        $second = app(AssetQrService::class)->generate($first, $admin, true);
        $this->assertNotSame($old, $second->qr_token);
        $this->getJson('/api/v1/public/assets/'.$old)->assertNotFound();
        $this->getJson('/api/v1/public/assets/'.$second->qr_token)->assertOk();
    }

    public function test_location_and_custodian_mapping_updates_staging_rows(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $path = sys_get_temp_dir().'/template-map-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'legacy_location', 'custodian_candidate'],
            ['CE-3001', 'Mapped laptop', 'Office 16C', 'ICT'],
        ]);
        (new Xlsx($sheet))->save($path);

        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        $batchId = $res->json('data.batch.id');
        unlink($path);

        $location = \App\Models\AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'HO_16C',
            'name' => 'Head Office 16C',
            'location_type' => 'office',
            'is_active' => true,
        ]);

        $http->postJson("/api/v1/assets/import/{$batchId}/map-location", [
            'legacy_location' => 'Office 16C',
            'location_id' => $location->id,
        ])->assertOk();

        $this->assertDatabaseHas('asset_import_staging', [
            'import_batch_id' => $batchId,
            'asset_tag' => 'CE-3001',
            'location_id' => $location->id,
        ]);

        $http->postJson("/api/v1/assets/import/{$batchId}/map-custodian", [
            'legacy_key' => 'ICT',
            'custodian_type' => 'shared',
        ])->assertOk();

        $this->assertDatabaseHas('asset_import_staging', [
            'import_batch_id' => $batchId,
            'asset_tag' => 'CE-3001',
            'custodian_type' => 'shared',
        ]);

        $http->postJson("/api/v1/assets/import/{$batchId}/commit", ['approve_non_blocking' => true])->assertOk();
        $asset = Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'CE-3001')->first();
        $this->assertNotNull($asset?->location_id);
        $this->assertDatabaseHas('asset_location_histories', [
            'asset_id' => $asset->id,
            'location_id' => $location->id,
        ]);
    }

    public function test_legacy_mode_requires_both_crystal_listings(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $http->post('/api/v1/assets/import', [
            'mode' => 'legacy',
            'category' => $this->uploaded($this->fixture('2036_Fixed_Assets_Listing_Category_31_March_2026.xls'), 'category.xls'),
        ])->assertStatus(422);
    }

    public function test_mappings_reject_foreign_tenant_batch_and_location(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        [$httpA, $adminA] = $this->asAdmin($tenantA);
        $adminB = $this->makeAdmin($tenantB);

        $path = sys_get_temp_dir().'/template-tenant-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'legacy_location'],
            ['CE-3301', 'Tenant laptop', 'Office 16C'],
        ]);
        (new Xlsx($sheet))->save($path);
        $res = $httpA->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        $batchId = $res->json('data.batch.id');
        unlink($path);

        $foreignLocation = \App\Models\AssetLocation::create([
            'tenant_id' => $tenantB->id,
            'code' => 'FOREIGN',
            'name' => 'Other tenant room',
            'location_type' => 'office',
            'is_active' => true,
        ]);

        $this->asUser($adminA);
        $httpA->postJson("/api/v1/assets/import/{$batchId}/map-location", [
            'legacy_location' => 'Office 16C',
            'location_id' => $foreignLocation->id,
        ])->assertStatus(422);

        $this->asUser($adminB);
        $httpA->postJson("/api/v1/assets/import/{$batchId}/map-location", [
            'legacy_location' => 'Office 16C',
            'location_id' => $foreignLocation->id,
        ])->assertNotFound();
    }

    public function test_committed_staging_rows_cannot_be_edited(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $path = sys_get_temp_dir().'/template-lock-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name'],
            ['CE-3401', 'Locked laptop'],
        ]);
        (new Xlsx($sheet))->save($path);
        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        $batchId = $res->json('data.batch.id');
        unlink($path);
        $http->postJson("/api/v1/assets/import/{$batchId}/commit", ['approve_non_blocking' => true])->assertOk();
        $stagingId = AssetImportBatch::find($batchId)->stagingRows()->first()->id;
        $http->patchJson("/api/v1/assets/import/{$batchId}/staging/{$stagingId}", [
            'asset_name' => 'Tampered',
        ])->assertStatus(422);
    }

    public function test_label_print_overflows_avery_18_up_onto_a_second_page(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        app(AssetImportCommitService::class)->seedDefaultTemplates($tenant->id);
        $template = \App\Models\AssetLabelTemplate::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', 'avery_l7161_permanent')
            ->first();
        $this->assertSame(18, (int) $template->rows * (int) $template->columns);

        $ids = [];
        for ($i = 1; $i <= 19; $i++) {
            $asset = Asset::create([
                'tenant_id' => $tenant->id,
                'asset_code' => sprintf('CE-%04d', 5000 + $i),
                'tag_number' => sprintf('CE-%04d', 5000 + $i),
                'name' => 'Overflow '.$i,
                'category' => 'it',
                'status' => 'active',
            ]);
            app(AssetQrService::class)->ensure($asset, $user);
            $ids[] = $asset->id;
        }

        $this->asUser($user);
        $print = $http->postJson('/api/v1/assets/labels/print', [
            'asset_ids' => $ids,
            'template_id' => $template->id,
            'json' => true,
        ]);
        $print->assertCreated();
        $this->assertSame(19, (int) $print->json('data.number_of_labels'));
        $this->assertSame(19, \App\Models\AssetLabelBatchItem::query()->count());
    }

    public function test_location_move_writes_append_only_movement_history(): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asAdmin($tenant);
        $from = \App\Models\AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'FROM',
            'name' => 'Store A',
            'location_type' => 'store',
            'is_active' => true,
        ]);
        $to = \App\Models\AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'TO',
            'name' => 'Office 16C',
            'location_type' => 'office',
            'is_active' => true,
        ]);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-6100',
            'tag_number' => 'CE-6100',
            'name' => 'Moved laptop',
            'category' => 'it',
            'status' => 'active',
            'location_id' => $from->id,
        ]);

        app(\App\Modules\Assets\Services\AssetService::class)->setLocation($asset, $to->id, $user, 'Relocated');

        $this->assertDatabaseHas('asset_movements', [
            'asset_id' => $asset->id,
            'movement_type' => 'move',
            'from_location_id' => $from->id,
            'to_location_id' => $to->id,
        ]);
        $this->assertDatabaseHas('asset_location_histories', [
            'asset_id' => $asset->id,
            'location_id' => $to->id,
        ]);
        $this->assertSame($from->id, $from->fresh()->id);
    }

    public function test_repair_and_missing_movements_are_append_only(): void
    {
        $tenant = Tenant::factory()->create();
        [, $user] = $this->asAdmin($tenant);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-7200',
            'tag_number' => 'CE-7200',
            'name' => 'Repair laptop',
            'category' => 'it',
            'status' => 'active',
        ]);
        $service = app(\App\Modules\Assets\Services\AssetService::class);
        $service->sendForRepair($asset, $user, ['notes' => 'Screen']);
        $service->returnFromRepair($asset->fresh(), $user);
        $service->markMissing($asset->fresh(), $user);
        $service->recover($asset->fresh(), $user);

        $this->assertDatabaseHas('asset_movements', ['asset_id' => $asset->id, 'movement_type' => 'send_for_repair']);
        $this->assertDatabaseHas('asset_movements', ['asset_id' => $asset->id, 'movement_type' => 'return_from_repair']);
        $this->assertDatabaseHas('asset_movements', ['asset_id' => $asset->id, 'movement_type' => 'mark_missing']);
        $this->assertDatabaseHas('asset_movements', ['asset_id' => $asset->id, 'movement_type' => 'recover']);
        $this->assertSame(4, \App\Models\AssetMovement::query()->where('asset_id', $asset->id)->count());
    }

    public function test_verify_permission_can_record_qr_scan_result(): void
    {
        $tenant = Tenant::factory()->create();
        [, $admin] = $this->asAdmin($tenant);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-7100',
            'tag_number' => 'CE-7100',
            'name' => 'Scan laptop',
            'category' => 'it',
            'status' => 'active',
        ]);
        $asset = app(AssetQrService::class)->ensure($asset, $admin);
        $campaign = app(\App\Modules\Assets\Services\AssetVerificationService::class)->createCampaign([
            'name' => 'QR scan campaign',
            'starts_on' => now()->toDateString(),
        ], $admin);

        $verifier = $this->makeUser('staff', $tenant);
        $verifier->givePermissionTo(['assets.view', 'assets.verify']);
        $http = $this->asUser($verifier);

        $http->getJson('/api/v1/assets/qr/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonPath('data.asset_tag', 'CE-7100');

        $http->postJson('/api/v1/assets-meta/verification-campaigns/'.$campaign->id.'/results', [
            'asset_id' => $asset->id,
            'result' => 'verified',
            'verification_method' => 'qr',
        ])->assertCreated();
    }

    public function test_matcher_cascade_tag_serial_description_never_fuzzy(): void
    {
        $tenant = Tenant::factory()->create();
        $this->asAdmin($tenant);
        $matcher = app(\App\Modules\Assets\Import\AssetExistingMatcher::class);

        $byTag = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-8101',
            'tag_number' => 'CE-8101',
            'name' => 'Tagged laptop',
            'category' => 'it',
            'status' => 'active',
            'serial_number' => 'SN-OTHER',
        ]);
        $this->assertSame($byTag->id, $matcher->match($tenant->id, 'CE-8101', 'SN-IGNORED', [], [], 0)?->id);

        $bySerial = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-8102',
            'tag_number' => 'CE-8102',
            'name' => 'Serial laptop',
            'category' => 'it',
            'status' => 'active',
            'serial_number' => 'SN-UNIQUE-8102',
        ]);
        $this->assertSame($bySerial->id, $matcher->match($tenant->id, 'CE-9999', 'SN-UNIQUE-8102', [], [], 0)?->id);

        $byDesc = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'FF-8103',
            'tag_number' => 'FF-8103',
            'name' => 'Oak desk',
            'category' => 'furniture',
            'status' => 'active',
            'legacy_description' => 'Oak desk',
            'legacy_location' => 'Office 9',
            'purchase_date' => '2019-01-15',
        ]);
        $this->assertSame($byDesc->id, $matcher->match($tenant->id, 'FF-0000', null, [
            'legacy_description' => 'Oak desk',
            'legacy_location' => 'Office 9',
            'acquisition_date' => '2019-01-15',
        ], [], 0)?->id);

        $this->assertNull($matcher->match($tenant->id, 'FF-0001', null, [
            'legacy_description' => 'Oak desk extra drawer',
            'legacy_location' => 'Office 9',
            'acquisition_date' => '2019-01-15',
        ], [], 0));
        $this->assertNull($matcher->match($tenant->id, 'FF-0002', null, [
            'legacy_description' => 'Oak desk',
            'legacy_location' => 'Office 9',
            'acquisition_date' => null,
        ], [], 0));

        $prior = AssetImportBatch::create([
            'tenant_id' => $tenant->id,
            'batch_number' => 'AST-IMPORT-TEST-FP',
            'mode' => 'template',
            'status' => 'committed',
            'fingerprint' => str_repeat('a', 64),
        ]);
        $raw = AssetImportRaw::create([
            'import_batch_id' => $prior->id,
            'source_filename' => 'prior.xlsx',
            'source_row_number' => 2,
            'source_kind' => 'template',
            'raw_json' => ['asset_tag' => 'CE-FP01'],
            'row_fingerprint' => hash('sha256', 'fingerprint-row'),
        ]);
        $fpAsset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-FP01',
            'tag_number' => 'CE-FP01',
            'name' => 'Fingerprint laptop',
            'category' => 'it',
            'status' => 'active',
        ]);
        AssetImportLineage::create([
            'import_batch_id' => $prior->id,
            'asset_tag' => 'CE-FP01',
            'raw_id' => $raw->id,
            'source_kind' => 'template',
        ]);
        $current = AssetImportBatch::create([
            'tenant_id' => $tenant->id,
            'batch_number' => 'AST-IMPORT-TEST-FP2',
            'mode' => 'template',
            'status' => 'review',
            'fingerprint' => str_repeat('b', 64),
        ]);
        $currentRaw = AssetImportRaw::create([
            'import_batch_id' => $current->id,
            'source_filename' => 'current.xlsx',
            'source_row_number' => 2,
            'source_kind' => 'template',
            'raw_json' => ['asset_tag' => 'CE-NEW'],
            'row_fingerprint' => hash('sha256', 'fingerprint-row'),
        ]);
        $this->assertSame($fpAsset->id, $matcher->match($tenant->id, 'CE-NEW', null, [], [
            ['raw_id' => $currentRaw->id],
        ], (int) $current->id)?->id);
    }

    public function test_template_import_matches_existing_unique_serial(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'SADCPF-OLD-4401',
            'tag_number' => 'SADCPF-OLD-4401',
            'name' => 'Existing laptop',
            'category' => 'it',
            'status' => 'active',
            'serial_number' => 'SN-MATCH-1',
        ]);

        $path = sys_get_temp_dir().'/template-serial-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'serial_number'],
            ['CE-4401', 'Imported laptop', 'SN-MATCH-1'],
        ]);
        (new Xlsx($sheet))->save($path);

        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        unlink($path);

        $row = \App\Models\AssetImportStaging::query()
            ->where('import_batch_id', $res->json('data.batch.id'))
            ->where('asset_tag', 'CE-4401')
            ->first();
        $this->assertNotNull($row);
        $this->assertNotNull($row->matched_asset_id);
        $this->assertContains($row->proposed_action, ['UPDATE', 'REQUIRES_REVIEW']);
        $this->assertTrue((bool) $res->json('data.auto_approve_allowed'));
    }

    public function test_production_commit_ignores_auto_approve(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $user->givePermissionTo('assets.import');
        $http = $this->asUser($user);

        $path = sys_get_temp_dir().'/template-prod-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name'],
            ['CE-5501', 'Prod gate laptop'],
        ]);
        (new Xlsx($sheet))->save($path);
        $res = $http->post('/api/v1/assets/import', [
            'mode' => 'template',
            'template' => $this->uploaded($path, 'template.xlsx'),
        ]);
        $res->assertCreated();
        unlink($path);
        $batchId = $res->json('data.batch.id');

        config(['app.env' => 'production']);
        $http->getJson("/api/v1/assets/import/{$batchId}")
            ->assertOk()
            ->assertJsonPath('data.auto_approve_allowed', false);

        $http->postJson("/api/v1/assets/import/{$batchId}/commit", ['approve_non_blocking' => true])
            ->assertStatus(422);
        $this->assertDatabaseHas('asset_import_staging', [
            'import_batch_id' => $batchId,
            'asset_tag' => 'CE-5501',
            'review_status' => 'pending',
        ]);
        $this->assertSame(0, Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'CE-5501')->count());
    }
}
