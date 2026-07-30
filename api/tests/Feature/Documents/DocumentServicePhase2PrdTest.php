<?php

namespace Tests\Feature\Documents;

use App\Models\Documents\DocumentFileObject;
use App\Models\Documents\DocumentGovernanceDecision;
use App\Models\Documents\DocumentLink;
use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Models\Tenant;
use App\Modules\Documents\Drivers\NullMalwareScanner;
use App\Modules\Documents\Services\DocumentStorageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentServicePhase2PrdTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['filesystems.default' => 'local', 'documents.av_driver' => 'null']);
    }

    public function test_failed_scan_is_not_marked_clean(): void
    {
        $service = app(DocumentStorageService::class);
        $this->assertSame('error', $service->normalizeScanStatus(['status' => 'error']));
        $this->assertSame('pending', $service->normalizeScanStatus(['status' => 'pending']));
        $this->assertSame('clean', $service->normalizeScanStatus(['status' => 'clean']));
        $this->assertSame('infected', $service->normalizeScanStatus(['status' => 'infected']));
        $this->assertSame('error', $service->normalizeScanStatus(['status' => 'weird']));
    }

    public function test_upload_creates_file_object_and_version_hash(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $bytes = "%PDF-1.4\nprd-phase2-".str_repeat('B', 32);
        $hash = hash('sha256', $bytes);
        $file = UploadedFile::fake()->createWithContent('policy.pdf', $bytes);

        $res = $this->post('/api/v1/documents', [
            'file' => $file,
            'title' => 'Policy',
            'module' => 'general',
            'document_type' => 'policy',
        ], ['Accept' => 'application/json']);

        $res->assertCreated();
        $this->assertSame($hash, $res->json('data.version.content_hash'));
        $this->assertSame('clean', $res->json('data.version.quarantine_status'));
        $this->assertDatabaseHas('document_file_objects', [
            'tenant_id' => $tenant->id,
            'content_hash' => $hash,
            'quarantine_status' => 'clean',
        ]);
    }

    public function test_legal_hold_blocks_purge(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $service = app(DocumentStorageService::class);

        $result = $service->upload($admin, $this->fakePdf('hold.pdf'), ['title' => 'Held']);
        $doc = $result['document'];
        $service->placeLegalHold($admin, $doc, 'Litigation hold');

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->purge($admin, $doc->fresh());
    }

    public function test_verify_by_hash_returns_approved_metadata_only(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $service = app(DocumentStorageService::class);
        $result = $service->upload($admin, $this->fakePdf('v.pdf'), ['title' => 'Secret Title', 'module' => 'audit']);
        $hash = $result['version']->content_hash;

        $internal = $this->getJson("/api/v1/documents/verify/{$hash}");
        $internal->assertOk()->assertJsonPath('data.verified', true);
        $this->assertArrayHasKey('matches', $internal->json('data'));

        $public = $this->getJson("/api/v1/documents/public/verify/{$hash}");
        $public->assertOk()->assertJsonPath('data.verified', true);
        $match = $public->json('data.matches.0') ?? [];
        $this->assertArrayNotHasKey('storage_path', $match);
        $this->assertArrayNotHasKey('title', $match);
        $this->assertArrayNotHasKey('document_id', $match);
    }

    public function test_unlink_does_not_delete_managed_document(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $service = app(DocumentStorageService::class);
        $result = $service->upload($admin, $this->fakePdf('linked.pdf'), [
            'title' => 'Linked',
            'module' => 'pif',
        ]);
        $doc = $result['document'];
        $version = $result['version'];

        // Link the same document to the actor as a synthetic subject (user as linkable).
        $link = $service->createLink($admin, $doc, $version, $admin, 'attachment', 'memo');
        $this->assertNull($link->unlinked_at);

        $service->unlink($admin, $link);
        $this->assertNotNull($link->fresh()->unlinked_at);
        $this->assertDatabaseHas('managed_documents', ['id' => $doc->id]);
        $this->assertTrue(DocumentVersion::query()->where('id', $version->id)->exists());
    }

    public function test_governance_checklist_defaults_pending(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $res = $this->getJson('/api/v1/documents/governance');
        $res->assertOk();
        $rows = $res->json('data');
        $this->assertNotEmpty($rows);
        $this->assertSame('pending', $rows[0]['status']);
        $this->assertDatabaseHas('document_governance_decisions', [
            'tenant_id' => $tenant->id,
            'decision_key' => 'approved_av_product',
            'status' => DocumentGovernanceDecision::STATUS_PENDING,
        ]);
    }

    public function test_ai_suggest_is_guarded_stub(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $service = app(DocumentStorageService::class);
        $doc = $service->upload($admin, $this->fakePdf('ai.pdf'), ['title' => 'AI'])['document'];

        $res = $this->postJson("/api/v1/documents/{$doc->id}/ai-suggest", ['action' => 'summarise']);
        $res->assertOk()
            ->assertJsonPath('data.requires_human_confirm', true)
            ->assertJsonPath('data.guards.never_change_authoritative_version', true)
            ->assertJsonPath('data.guards.never_release_quarantine', true);
    }

    public function test_null_scanner_provider_name(): void
    {
        $scanner = new NullMalwareScanner;
        $this->assertSame('null_passthrough', $scanner->providerName());
        $out = $scanner->scan('/tmp/x', 'local', 'x');
        $this->assertSame('clean', $out['status']);
    }
}
