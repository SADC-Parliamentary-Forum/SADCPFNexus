<?php

namespace Tests\Feature\Documents;

use App\Models\Documents\DocumentVersion;
use App\Models\Documents\ManagedDocument;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Documents\Services\DocumentStorageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DocumentServicePhase1Test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
    }

    public function test_upload_computes_stable_sha256_hash(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($user);

        $bytes = "%PDF-1.4\nstable-hash-payload-".str_repeat('A', 64);
        $expected = hash('sha256', $bytes);
        $file = UploadedFile::fake()->createWithContent('memo.pdf', $bytes);

        $response = $this->post('/api/v1/documents', [
            'file' => $file,
            'title' => 'Memo',
            'module' => 'workflow',
        ], ['Accept' => 'application/json']);

        $response->assertCreated();
        $versionId = $response->json('data.version.id');
        $hash = $response->json('data.version.content_hash');
        $this->assertSame($expected, $hash);

        // Re-read from service — hash must remain stable
        $version = DocumentVersion::findOrFail($versionId);
        $this->assertSame($expected, $version->content_hash);
        Storage::disk('local')->assertExists($version->storage_path);
    }

    public function test_finalize_makes_version_immutable_and_new_version_after_change(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $service = app(DocumentStorageService::class);
        $file1 = $this->fakePdf('v1.pdf');
        $result = $service->upload($admin, $file1, ['title' => 'Policy', 'module' => 'people']);
        $version1 = $result['version'];
        $document = $result['document'];

        $locked = $service->markFinal($admin, $version1);
        $this->assertTrue($locked->is_immutable);
        $this->assertSame(DocumentVersion::STATUS_FINAL, $locked->status);
        $this->assertTrue($document->fresh()->is_final);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->upload($admin, $this->fakePdf('v2.pdf'), [
            'document_id' => $document->id,
            'title' => 'Policy',
        ]);
    }

    public function test_signed_version_locked_and_new_version_allowed_when_not_final(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($user);

        $service = app(DocumentStorageService::class);
        $result = $service->upload($user, $this->fakePdf('sign-me.pdf'), [
            'title' => 'Contract',
            'module' => 'people',
        ]);
        $v1 = $result['version'];
        $doc = $result['document'];

        $service->lockAfterSignature($user, $v1, ['test' => true]);
        $v1->refresh();
        $this->assertTrue($v1->is_immutable);
        $this->assertSame(DocumentVersion::STATUS_IMMUTABLE, $v1->status);

        // Document not marked final — append new version for changes
        $result2 = $service->upload($user, $this->fakePdf('sign-me-v2.pdf'), [
            'document_id' => $doc->id,
        ]);
        $this->assertSame(2, $result2['version']->version_number);
        $this->assertFalse($result2['version']->is_immutable);
        $this->assertTrue($v1->fresh()->is_immutable);
    }

    public function test_unauthorized_download_denied(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenantA);
        $outsider = $this->makeUser('staff', $tenantB);

        $service = app(DocumentStorageService::class);
        Sanctum::actingAs($owner);
        $result = $service->upload($owner, $this->fakePdf('secret.pdf'), ['title' => 'Secret']);
        $version = $result['version'];

        Sanctum::actingAs($outsider);
        $response = $this->getJson("/api/v1/documents/versions/{$version->id}/download");
        $response->assertNotFound(); // tenant mismatch → 404
    }

    public function test_same_tenant_without_permission_denied_for_foreign_owner_doc(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeAdmin($tenant);
        // Create a user with no document permissions
        $stranger = User::factory()->create(['tenant_id' => $tenant->id]);
        // Do not assign document permissions

        $service = app(DocumentStorageService::class);
        Sanctum::actingAs($owner);
        $result = $service->upload($owner, $this->fakePdf('hr.pdf'), ['title' => 'HR']);
        $version = $result['version'];

        $this->assertFalse($service->authorizeDownload($stranger, $version));

        Sanctum::actingAs($stranger);
        $response = $this->getJson("/api/v1/documents/versions/{$version->id}/download");
        $response->assertForbidden();
    }

    public function test_download_token_is_short_lived_and_works_once(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($user);

        $service = app(DocumentStorageService::class);
        $result = $service->upload($user, $this->fakePdf('link.pdf'), ['title' => 'Link']);
        $version = $result['version'];

        $issued = $service->issueDownloadToken($user, $version, 120, 1);
        $this->assertNotEmpty($issued['token']);

        $ok = $this->get("/api/v1/documents/download-token/{$issued['token']}");
        $ok->assertOk();

        $again = $this->getJson("/api/v1/documents/download-token/{$issued['token']}");
        $again->assertForbidden();
    }

    public function test_metadata_and_versions_list(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($user);

        $upload = $this->post('/api/v1/documents', [
            'file' => $this->fakePdf('a.pdf'),
            'title' => 'A',
            'module' => 'correspondence',
        ], ['Accept' => 'application/json']);
        $upload->assertCreated();
        $docId = $upload->json('data.document.id');

        $this->getJson("/api/v1/documents/{$docId}")->assertOk()
            ->assertJsonPath('data.title', 'A');
        $this->getJson("/api/v1/documents/{$docId}/versions")->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
