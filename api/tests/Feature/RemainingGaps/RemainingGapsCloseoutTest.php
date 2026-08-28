<?php

namespace Tests\Feature\RemainingGaps;

use App\Models\AccessControl\AccessGovernanceDecision;
use App\Models\Asset;
use App\Models\AuditSetting;
use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\Documents\DocumentOcrJob;
use App\Models\Documents\DocumentVersion;
use App\Models\GlJournal;
use App\Models\GovernanceResolution;
use App\Models\InventoryRegisterEntry;
use App\Models\PeopleAuthority\IdentityDelegation;
use App\Models\StockItem;
use App\Models\Tenant;
use App\Models\WormArchiveEntry;
use App\Modules\Documents\Services\DocumentPhase23Service;
use App\Modules\Documents\Services\DocumentStorageService;
use App\Modules\PlatformAudit\Services\LocalWormArchive;
use App\Modules\Stock\Services\StockDemandForecastService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RemainingGapsCloseoutTest extends TestCase
{
    public function test_access_governance_can_be_updated_by_security_admin(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $row = AccessGovernanceDecision::create([
            'tenant_id' => $tenant->id,
            'topic' => 'MFA policy for privileged roles',
            'status' => 'pending',
        ]);
        Sanctum::actingAs($admin);

        $res = $this->putJson('/api/v1/admin/access/governance/'.$row->id, [
            'status' => 'decided',
            'decision_notes' => 'Privileged MFA required in production.',
        ]);

        $res->assertOk()->assertJsonPath('data.status', 'decided');
        $this->assertDatabaseHas('access_governance_decisions', [
            'id' => $row->id,
            'status' => 'decided',
        ]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'access.governance.updated']);
    }

    public function test_staff_cannot_update_access_governance(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $row = AccessGovernanceDecision::create([
            'tenant_id' => $tenant->id,
            'topic' => 'Break-glass',
            'status' => 'pending',
        ]);
        Sanctum::actingAs($staff);

        $this->putJson('/api/v1/admin/access/governance/'.$row->id, [
            'status' => 'decided',
            'decision_notes' => 'nope',
        ])->assertForbidden();
    }

    public function test_http_ocr_driver_completes_queued_job(): void
    {
        Storage::fake('local');
        Http::fake([
            'https://ocr.example.test/*' => Http::response(['text' => 'EXTRACTED OCR TEXT', 'status' => 'complete'], 200),
        ]);
        config([
            'documents.ocr_driver' => 'http',
            'documents.http_ocr.url' => 'https://ocr.example.test/v1/ocr',
            'documents.http_ocr.token' => 'test-token',
        ]);

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $uploaded = app(DocumentStorageService::class)->upload($admin, $this->fakePdf('ocr.pdf'), ['title' => 'OCR']);
        /** @var DocumentVersion $version */
        $version = $uploaded['version'];

        $queued = app(DocumentPhase23Service::class)->queueOcr($admin, $version);
        $this->assertSame('queued', $queued->status);

        $this->artisan('documents:process-ocr-jobs')->assertSuccessful();

        $this->assertSame('complete', $queued->fresh()->status);
        $this->assertSame('EXTRACTED OCR TEXT', $queued->fresh()->extracted_text);
    }

    public function test_worm_archive_is_append_only_and_hash_chained(): void
    {
        Storage::fake('worm');
        config(['audit.worm_driver' => 'local']);

        $tenant = Tenant::factory()->create();
        $archive = app(LocalWormArchive::class);
        $first = $archive->append($tenant->id, 'audit.login', ['outcome' => 'success']);
        $second = $archive->append($tenant->id, 'audit.logout', ['outcome' => 'success']);

        $this->assertNotSame($first->content_hash, $second->content_hash);
        $this->assertSame($first->content_hash, $second->previous_hash);
        $this->assertTrue($archive->verifyChain($tenant->id));
        $this->expectException(\RuntimeException::class);
        $archive->rewrite($first);
    }

    public function test_sharepoint_status_is_ready_when_http_url_configured(): void
    {
        config([
            'documents.sharepoint_http_url' => 'https://graph.example.test/migrate',
            'documents.sharepoint_http_token' => 'tok',
        ]);
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $res = $this->getJson('/api/v1/documents/migration-status');
        $res->assertOk()
            ->assertJsonPath('data.status', 'ready')
            ->assertJsonPath('data.drivers.0', 'http');
    }

    public function test_gl_journal_posts_balanced_lines_to_budget_gl_code(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeFinanceController($tenant);
        Sanctum::actingAs($admin);

        $budget = Budget::query()->create([
            'tenant_id' => $tenant->id,
            'year' => '2026',
            'name' => 'FY26',
            'type' => 'core',
            'status' => 'active',
        ]);
        $line = BudgetLine::query()->create([
            'budget_id' => $budget->id,
            'category' => 'travel',
            'code' => '6100',
            'name' => 'Travel',
            'gl_account_code' => '6100-001',
            'amount_allocated' => 10000,
            'amount_spent' => 0,
            'is_active' => true,
        ]);

        $res = $this->postJson('/api/v1/budget/journals', [
            'budget_line_id' => $line->id,
            'memo' => 'Travel actual',
            'source_module' => 'travel',
            'debit' => 250.50,
            'credit' => 250.50,
        ]);

        $res->assertCreated()->assertJsonPath('data.status', 'posted');
        $this->assertDatabaseHas('gl_journals', ['tenant_id' => $tenant->id, 'status' => 'posted']);
        $journalId = (int) $res->json('data.id');
        $this->assertSame(2, GlJournal::query()->findOrFail($journalId)->lines()->count());
    }

    public function test_unified_inventory_register_lists_split_handoff(): void
    {
        $tenant = Tenant::factory()->create();
        $asset = Asset::query()->create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-TEST1',
            'name' => 'Laptop',
            'category' => 'equipment',
            'status' => 'pending',
        ]);
        $stock = StockItem::query()->create([
            'tenant_id' => $tenant->id,
            'item_code' => 'STK-TEST1',
            'name' => 'Laptop bag',
            'status' => 'active',
            'current_balance' => 1,
        ]);
        InventoryRegisterEntry::query()->create([
            'tenant_id' => $tenant->id,
            'source' => 'grn_split',
            'asset_id' => $asset->id,
            'stock_item_id' => $stock->id,
            'label' => 'Laptop kit',
        ]);

        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $res = $this->getJson('/api/v1/inventory/unified-register');
        $res->assertOk();
        $this->assertGreaterThanOrEqual(1, count($res->json('data')));
    }

    public function test_biometric_clock_in_records_event_and_sets_analytics_flag(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($user);

        $res = $this->postJson('/api/v1/hr/timesheets/attendance/clock', [
            'direction' => 'in',
            'method' => 'biometric',
            'device_attested' => true,
        ]);
        $res->assertCreated()->assertJsonPath('data.direction', 'in');
        $this->assertDatabaseHas('attendance_clock_events', [
            'user_id' => $user->id,
            'direction' => 'in',
            'method' => 'biometric',
        ]);

        $start = now()->startOfWeek()->toDateString();
        $end = now()->endOfWeek()->toDateString();
        $analytics = $this->getJson('/api/v1/hr/timesheets/capacity-analytics?week_start='.$start.'&week_end='.$end);
        $analytics->assertOk()->assertJsonPath('data.biometric', true);
    }

    public function test_monthly_instalments_policy_allows_repayment_months(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $res = $this->postJson('/api/v1/finance/advances/policies', [
            'version' => 'v-instalments',
            'effective_from' => now()->toDateString(),
            'recovery_rule' => 'monthly_instalments',
            'change_reason' => 'Allow 6-month recovery.',
        ]);
        $res->assertCreated()->assertJsonPath('data.recovery_rule', 'monthly_instalments');

        $staff = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($staff);
        $create = $this->postJson('/api/v1/finance/advances', [
            'advance_type' => 'medical',
            'amount' => 1200,
            'purpose' => 'Medical',
            'justification' => 'Hospital bill requiring instalments over six months.',
            'repayment_months' => 6,
        ]);
        $create->assertCreated()->assertJsonPath('data.repayment_months', 6);
    }

    public function test_parliament_connect_is_public_and_lists_published_resolutions(): void
    {
        $tenant = Tenant::factory()->create();
        GovernanceResolution::query()->create([
            'tenant_id' => $tenant->id,
            'reference_number' => 'RES-PUB-1',
            'title' => 'Public resolution',
            'description' => 'Adopted text',
            'status' => 'adopted',
            'adopted_at' => now()->toDateString(),
        ]);

        $res = $this->getJson('/api/v1/parliament-connect/feed');
        $res->assertOk();
        $titles = collect($res->json('data.resolutions'))->pluck('title')->all();
        $this->assertContains('Public resolution', $titles);
    }

    public function test_privileged_role_sync_requires_dual_control(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $target = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($admin);

        $res = $this->patchJson('/api/v1/admin/users/'.$target->id.'/roles', [
            'roles' => ['Secretary General'],
        ]);
        $res->assertStatus(202)->assertJsonPath('data.status', 'pending_approval');
        $this->assertFalse($target->fresh()->hasRole('Secretary General'));
    }

    public function test_saam_delegation_mirrors_into_people_authority(): void
    {
        $tenant = Tenant::factory()->create();
        $principal = $this->makeAdmin($tenant);
        $delegate = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($principal);

        $res = $this->postJson('/api/v1/saam/delegations', [
            'delegate_user_id' => $delegate->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addWeek()->toDateString(),
            'reason' => 'Cover leave',
        ]);
        $res->assertCreated();
        $this->assertTrue(
            IdentityDelegation::query()->where('legacy_delegated_authority_id', $res->json('data.id'))->exists()
        );
    }

    public function test_stock_forecast_marks_exponential_smoothing_method(): void
    {
        $tenant = Tenant::factory()->create();
        $rows = app(StockDemandForecastService::class)->suggest($tenant->id);
        $this->assertIsArray($rows);
        $this->assertContains(app(StockDemandForecastService::class)->methodLabel(), [
            'exponential_smoothing',
            'usage_math',
            'http_ml',
        ]);
    }

    public function test_audit_charter_can_be_configured(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $res = $this->putJson('/api/v1/audit-management/settings', [
            'plan_approval_mode' => 'sg',
            'charter_configured' => true,
            'charter_notes' => 'Charter adopted by Plenary.',
        ]);
        $res->assertOk()->assertJsonPath('data.charter_configured', true);
        $this->assertTrue((bool) AuditSetting::query()->where('tenant_id', $tenant->id)->value('charter_configured'));
    }

    public function test_worm_governance_meta_reflects_local_driver(): void
    {
        config(['audit.worm_driver' => 'local']);
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $res = $this->getJson('/api/v1/audit-admin/governance');
        $res->assertOk();
        $this->assertNotSame('Governance Configuration Pending', $res->json('meta.phase2_pending.worm_archive'));
    }
}
