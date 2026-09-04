<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetImportBatch;
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
        $http->post('/api/v1/assets/import', [])->assertForbidden();
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
}
