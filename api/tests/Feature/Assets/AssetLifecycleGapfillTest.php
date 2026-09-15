<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetCheckout;
use App\Models\AssetLabel;
use App\Models\AssetLocation;
use App\Models\AssetRecoveryContact;
use App\Models\AssetTransfer;
use App\Models\Lifecycle\LifecycleCase;
use App\Models\Lifecycle\LifecycleJourneyTemplate;
use App\Models\Lifecycle\LifecycleJourneyTemplateVersion;
use App\Models\Lifecycle\LifecycleStageInstance;
use App\Models\Lifecycle\LifecycleTaskInstance;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Assets\Services\AssetQrService;
use App\Modules\Assets\Services\AssetService;
use Tests\TestCase;

class AssetLifecycleGapfillTest extends TestCase
{
    private function seedCategory(Tenant $tenant, string $code = 'ICT'): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => $code,
            'useful_life_years' => 3,
        ]);
    }

    private function seedAsset(Tenant $tenant, AssetCategory $category, array $extra = []): Asset
    {
        return Asset::create(array_merge([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-'.uniqid(),
            'name' => 'Dell Latitude Laptop',
            'category' => $category->code,
            'status' => 'active',
            'condition' => 'good',
        ], $extra));
    }

    public function test_recovery_contact_is_versioned_audited_and_shown_on_public_scan(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $category = $this->seedCategory($tenant);
        $asset = $this->seedAsset($tenant, $category, ['tag_number' => 'PF/ICT/LT/027']);
        app(AssetQrService::class)->ensure($asset, $admin);

        $http->putJson('/api/v1/asset-settings/recovery-contact', [
            'department' => 'Administration & Logistics',
            'primary_phone' => '+264 61 123 456',
            'email' => 'assets@sadcpf.org',
            'whatsapp' => '+264 81 123 456',
            'instructions' => 'If found, please contact SADC Parliamentary Forum Administration.',
            'show_primary_phone' => true,
            'show_email' => true,
            'show_whatsapp' => true,
            'reason' => 'Initial contact setup',
        ])->assertOk()
            ->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.primary_phone', '+264 61 123 456');

        $this->getJson('/api/v1/public/assets/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonPath('data.assetNumber', 'PF/ICT/LT/027')
            ->assertJsonPath('data.publicStatus', 'REGISTERED')
            ->assertJsonPath('data.recoveryContact.telephone', '+264 61 123 456')
            ->assertJsonPath('data.recoveryContact.email', 'assets@sadcpf.org')
            ->assertJsonMissingPath('data.purchase_value')
            ->assertJsonMissingPath('data.custodian')
            ->assertJsonMissingPath('data.serial_number');

        $http->putJson('/api/v1/asset-settings/recovery-contact', [
            'department' => 'Administration & Logistics',
            'primary_phone' => '+264 61 987 654',
            'email' => 'assets@sadcpf.org',
            'show_primary_phone' => true,
            'show_email' => true,
            'reason' => 'Administration office number changed.',
        ])->assertOk()->assertJsonPath('data.version', 2);

        $this->getJson('/api/v1/public/assets/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonPath('data.recoveryContact.telephone', '+264 61 987 654');

        $http->getJson('/api/v1/asset-settings/recovery-contact/history')
            ->assertOk()
            ->assertJsonPath('data.0.version', 2)
            ->assertJsonPath('data.1.version', 1);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'assets.recovery_contact_changed',
            'auditable_type' => AssetRecoveryContact::class,
        ]);
    }

    public function test_recovery_contact_change_flags_printed_labels_for_reprint(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $category = $this->seedCategory($tenant);
        $asset = $this->seedAsset($tenant, $category, ['tag_number' => 'PF/ICT/LT/028']);
        app(AssetQrService::class)->ensure($asset, $admin);

        $http->putJson('/api/v1/asset-settings/recovery-contact', [
            'primary_phone' => '+264 61 111 111',
            'email' => 'assets@sadcpf.org',
            'show_primary_phone' => true,
            'show_email' => true,
            'reason' => 'v1',
        ])->assertOk();

        $http->getJson('/api/v1/assets/labels/templates')->assertOk();
        $templateId = $http->getJson('/api/v1/assets/labels/templates')->json('data.0.id');
        $this->assertNotEmpty($templateId);

        $http->postJson('/api/v1/assets/labels/print', [
            'asset_ids' => [$asset->id],
            'template_id' => $templateId,
            'json' => true,
        ])->assertCreated();

        $asset->refresh();
        $this->assertSame('printed', $asset->label_status);
        $label = AssetLabel::query()->where('asset_id', $asset->id)->where('status', 'current')->first();
        $this->assertNotNull($label);
        $printedVersion = $label->recovery_contact_version;

        $http->putJson('/api/v1/asset-settings/recovery-contact', [
            'primary_phone' => '+264 61 222 222',
            'email' => 'assets@sadcpf.org',
            'show_primary_phone' => true,
            'show_email' => true,
            'reason' => 'v2',
        ])->assertOk();

        $asset->refresh();
        $this->assertSame('reprint_required', $asset->label_status);
        $this->assertSame('CONTACT_CHANGED', $asset->label_reprint_reason);
        $label->refresh();
        $this->assertSame('reprint_required', $label->status);
        $this->assertNotEquals($printedVersion, AssetRecoveryContact::query()->where('tenant_id', $tenant->id)->whereNull('asset_category_id')->value('version'));

        $http->getJson('/api/v1/assets/labels/reprint-queue')
            ->assertOk();
        $ids = collect($http->getJson('/api/v1/assets/labels/reprint-queue')->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($asset->id));

        $http->postJson('/api/v1/assets/labels/print', [
            'asset_ids' => [$asset->id],
            'template_id' => $templateId,
            'reprint' => true,
            'reprint_reason' => 'CONTACT_CHANGED',
            'json' => true,
        ])->assertCreated();

        $asset->refresh();
        $this->assertSame('printed', $asset->label_status);
        $this->assertNull($asset->label_reprint_reason);
        $this->assertSame('current', AssetLabel::query()->where('asset_id', $asset->id)->latest('id')->value('status'));
    }

    public function test_public_scan_reflects_lost_stolen_and_disposed_without_exposing_staff(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $category = $this->seedCategory($tenant);
        $custodian = User::factory()->create(['tenant_id' => $tenant->id, 'email' => 'hidden@sadcpf.org']);
        $asset = $this->seedAsset($tenant, $category, [
            'tag_number' => 'PF/ICT/LT/029',
            'assigned_to' => $custodian->id,
        ]);
        app(AssetQrService::class)->ensure($asset, $admin);

        $http->putJson('/api/v1/asset-settings/recovery-contact', [
            'primary_phone' => '+264 61 333 333',
            'email' => 'assets@sadcpf.org',
            'show_primary_phone' => true,
            'show_email' => true,
            'reason' => 'setup',
        ])->assertOk();

        $http->postJson('/api/v1/assets/'.$asset->id.'/report-lost', [
            'date_noticed' => now()->toDateString(),
            'circumstances' => 'Left in taxi after mission.',
        ])->assertOk()->assertJsonPath('data.status', 'lost');

        $this->getJson('/api/v1/public/assets/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonPath('data.publicStatus', 'LOST')
            ->assertJsonPath('data.recoveryContact.telephone', '+264 61 333 333')
            ->assertJsonMissingPath('data.custodian');

        $this->postJson('/api/v1/public/assets/'.$asset->qr_token.'/found', [
            'name' => 'Jane Finder',
            'phone' => '+264 81 000 000',
            'message' => 'Found at Hosea Kutako arrivals.',
            'location' => 'Airport',
        ])->assertCreated();

        $http->postJson('/api/v1/assets/'.$asset->id.'/report-found', [
            'notes' => 'Recovered internally after public report.',
        ])->assertOk()->assertJsonPath('data.status', 'active');

        $this->getJson('/api/v1/public/assets/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonPath('data.publicStatus', 'REGISTERED');
    }

    public function test_auto_numbering_and_home_location_survive_moves(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $this->seedCategory($tenant, 'ICT');
        $categoryId = $http->getJson('/api/v1/asset-categories')->json('data.0.id');
        $http->postJson('/api/v1/asset-categories/'.$categoryId.'/subcategories', [
            'code' => 'LT',
            'name' => 'Laptops',
        ])->assertCreated();

        $http->putJson('/api/v1/asset-settings/numbering', [
            'prefix' => 'PF',
            'separator' => '/',
            'sequence_length' => 3,
            'auto_assign' => true,
        ])->assertOk();

        $store = AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'ict-store',
            'name' => 'ICT Equipment Store',
            'location_type' => 'store',
            'is_active' => true,
        ]);
        $boardroom = AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'boardroom',
            'name' => 'Boardroom',
            'location_type' => 'room',
            'is_active' => true,
        ]);

        $created = $http->postJson('/api/v1/assets', [
            'name' => 'ThinkPad',
            'category' => 'ICT',
            'subcategory_code' => 'LT',
            'home_location_id' => $store->id,
            'location_id' => $store->id,
            'ownership_type' => 'sadc_pf_owned',
            'funding_source' => 'Core Budget',
        ])->assertCreated();

        $id = $created->json('id') ?? $created->json('data.id');
        $tag = $created->json('tag_number') ?? $created->json('data.tag_number');
        $this->assertMatchesRegularExpression('#^PF/ICT/LT/\d{3}$#', (string) $tag);

        $http->postJson('/api/v1/assets/'.$id.'/move', [
            'location_id' => $boardroom->id,
            'reason' => 'Meeting support',
        ])->assertOk();

        $shown = $http->getJson('/api/v1/assets/'.$id)->assertOk();
        $payload = $shown->json('data') ?? $shown->json();
        $this->assertSame($boardroom->id, $payload['location_id']);
        $this->assertSame($store->id, $payload['home_location_id']);
        $this->assertSame('sadc_pf_owned', $payload['ownership_type']);
    }

    public function test_checkout_and_two_step_transfer_preserve_history(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $category = $this->seedCategory($tenant);
        $alice = User::factory()->create(['tenant_id' => $tenant->id]);
        $bob = User::factory()->create(['tenant_id' => $tenant->id]);
        $asset = $this->seedAsset($tenant, $category, ['tag_number' => 'PF/ICT/CAM/004', 'status' => 'available']);
        app(AssetQrService::class)->ensure($asset, $admin);

        $http->postJson('/api/v1/assets/'.$asset->id.'/checkout', [
            'borrower_id' => $alice->id,
            'purpose' => 'Plenary photography',
            'expected_return_at' => now()->addDay()->toIso8601String(),
            'condition_out' => 'good',
            'accessories' => ['lens', 'tripod'],
        ])->assertCreated();

        $asset->refresh();
        $this->assertSame('loan_out', $asset->status);
        $this->assertTrue(AssetCheckout::query()->where('asset_id', $asset->id)->whereNull('returned_at')->exists());

        $http->postJson('/api/v1/assets/'.$asset->id.'/return-checkout', [
            'condition_in' => 'good',
        ])->assertOk();
        $asset->refresh();
        $this->assertNotSame('loan_out', $asset->status);

        app(AssetService::class)->assign($asset, $alice, $admin, ['skip_handshake' => true]);

        $http->postJson('/api/v1/assets/'.$asset->id.'/transfers', [
            'to_user_id' => $bob->id,
            'reason' => 'Department rotation',
        ])->assertCreated();

        $transfer = AssetTransfer::query()->where('asset_id', $asset->id)->latest('id')->first();
        $this->assertSame('pending_outgoing', $transfer->status);
        $this->assertSame($alice->id, $asset->fresh()->assigned_to);

        $this->asUser($alice)->postJson('/api/v1/asset-transfers/'.$transfer->id.'/confirm-outgoing')->assertOk();
        $this->asUser($bob)->postJson('/api/v1/asset-transfers/'.$transfer->id.'/accept')->assertOk();

        $this->assertSame($bob->id, $asset->fresh()->assigned_to);
        $history = $this->asUser($admin)->getJson('/api/v1/assets/'.$asset->id.'/assignment-history')->json('data');
        $assignees = collect($history)->pluck('assigned_to')->all();
        $this->assertContains($alice->id, $assignees);
        $this->assertContains($bob->id, $assignees);

        $timeline = $this->asUser($admin)->getJson('/api/v1/assets/'.$asset->id.'/timeline')->assertOk()->json('data');
        $this->assertNotEmpty($timeline);
    }

    public function test_staff_without_financial_permission_cannot_see_book_value_on_profile(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp, $admin] = $this->asAdmin($tenant);
        $category = $this->seedCategory($tenant);
        $asset = $this->seedAsset($tenant, $category, [
            'purchase_value' => 28950,
            'book_value' => 20000,
        ]);
        app(AssetQrService::class)->ensure($asset, $admin);

        $staff = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('assets.view');
        $this->asUser($staff)->getJson('/api/v1/assets/'.$asset->id)
            ->assertOk()
            ->assertJsonPath('purchase_value', null)
            ->assertJsonPath('book_value', null);

        $this->asUser($admin)->getJson('/api/v1/assets/'.$asset->id)
            ->assertOk();
        $payload = $this->asUser($admin)->getJson('/api/v1/assets/'.$asset->id)->json();
        $this->assertNotNull($payload['purchase_value'] ?? $payload['data']['purchase_value'] ?? null);
    }

    public function test_ict_clearance_blocked_while_assets_remain_assigned(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $category = $this->seedCategory($tenant);
        $asset = $this->seedAsset($tenant, $category, ['assigned_to' => $employee->id, 'status' => 'assigned']);
        app(AssetService::class)->assign($asset->fresh(), $employee, $admin, ['skip_handshake' => true]);

        $template = LifecycleJourneyTemplate::create([
            'tenant_id' => $tenant->id,
            'code' => 'separation-test-assets',
            'name' => 'Test separation',
            'lifecycle_type' => 'separation',
            'status' => 'active',
            'created_by' => $admin->id,
        ]);
        $version = LifecycleJourneyTemplateVersion::create([
            'tenant_id' => $tenant->id,
            'template_id' => $template->id,
            'version_number' => 1,
            'status' => 'published',
            'definition' => ['stages' => []],
            'published_at' => now(),
            'published_by' => $admin->id,
            'created_by' => $admin->id,
        ]);
        $case = LifecycleCase::create([
            'tenant_id' => $tenant->id,
            'reference' => 'SEP-TEST-1',
            'employee_id' => $employee->id,
            'lifecycle_type' => 'separation',
            'template_version_id' => $version->id,
            'status' => 'in_progress',
            'revision' => 1,
            'created_by' => $admin->id,
            'terminal_payment_blocked' => true,
        ]);
        $stage = LifecycleStageInstance::create([
            'tenant_id' => $tenant->id,
            'case_id' => $case->id,
            'stage_key' => 'clearance',
            'name' => 'Clearance',
            'sort_order' => 1,
            'status' => 'in_progress',
        ]);
        $task = LifecycleTaskInstance::create([
            'tenant_id' => $tenant->id,
            'case_id' => $case->id,
            'stage_instance_id' => $stage->id,
            'task_key' => 'ict_clearance',
            'title' => 'ICT asset return and account closure',
            'status' => 'pending',
            'clearance_status' => 'pending',
            'mandatory' => true,
            'revision' => 1,
        ]);

        $admin->givePermissionTo('lifecycle.complete-department-tasks');
        $http->postJson('/api/v1/lifecycle/tasks/'.$task->id.'/clearance', [
            'clearance_status' => 'cleared',
            'revision' => 1,
        ])->assertStatus(422);
    }
}
