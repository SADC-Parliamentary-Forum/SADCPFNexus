<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetLabel;
use App\Models\AssetTimelineEvent;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Assets\Services\AssetLabelService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssetLabelEvidenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function laptop(Tenant $tenant): Asset
    {
        return Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-0098',
            'tag_number' => 'CE-0098',
            'name' => 'Laptop HP ProBook',
            'category' => 'it',
            'status' => 'active',
        ]);
    }

    private function printer(Tenant $tenant): User
    {
        $user = $this->makeUser('staff', $tenant);
        $user->givePermissionTo(['assets.print', 'assets.scan']);

        return $user;
    }

    private function printLabel(Asset $asset): void
    {
        $templateId = $this->getJson('/api/v1/assets/labels/templates')->assertOk()->json('data.0.id');
        $this->post('/api/v1/assets/labels/print', [
            'asset_ids' => [$asset->id],
            'template_id' => $templateId,
        ])->assertOk();
    }

    private function photo(): UploadedFile
    {
        return UploadedFile::fake()->image('label.jpg', 640, 480);
    }

    private function upload(Asset $asset, array $data)
    {
        return $this->post('/api/v1/assets/'.$asset->id.'/label-evidence', $data, ['Accept' => 'application/json']);
    }

    public function test_printer_records_placement_photo_and_note(): void
    {
        $tenant = Tenant::factory()->create();
        $asset = $this->laptop($tenant);
        $printer = $this->printer($tenant);
        Sanctum::actingAs($printer);
        $this->printLabel($asset);

        $this->getJson('/api/v1/assets/labels/awaiting-photo')
            ->assertOk()
            ->assertJsonPath('data.0.id', $asset->id);

        $this->upload($asset, [
            'photo' => $this->photo(),
            'placement_note' => '  Underside, next to the service tag ',
        ])->assertCreated()
            ->assertJsonPath('data.label_status', 'applied')
            ->assertJsonPath('data.label.label_version', 1)
            ->assertJsonPath('data.label.placement_note', 'Underside, next to the service tag')
            ->assertJsonPath('data.label.applied_by.id', $printer->id)
            ->assertJsonPath('data.label.photo.mime_type', 'image/jpeg');

        $label = AssetLabel::where('asset_id', $asset->id)->where('status', 'current')->firstOrFail();
        $this->assertNotNull($label->applied_at);
        $this->assertSame('photo_label', $label->appliedPhoto->document_type);
        $this->assertSame('applied', $asset->fresh()->label_status);
        $this->assertTrue(AssetTimelineEvent::where('asset_id', $asset->id)->where('event_type', 'LABEL_APPLIED')->exists());
        $this->assertTrue(AuditLog::where('event', 'assets.label_applied')->exists());

        $this->getJson('/api/v1/assets/'.$asset->id.'/label-evidence')
            ->assertOk()
            ->assertJsonPath('data.label.applied_by.id', $printer->id);
        $photo = $this->get('/api/v1/assets/'.$asset->id.'/label-evidence/photo');
        $photo->assertOk();
        $this->assertSame('image/jpeg', $photo->headers->get('content-type'));

        $this->getJson('/api/v1/assets/labels/awaiting-photo')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_reprint_needs_a_new_photo_and_versions_keep_counting(): void
    {
        $tenant = Tenant::factory()->create();
        $asset = $this->laptop($tenant);
        Sanctum::actingAs($this->printer($tenant));
        $this->printLabel($asset);
        $this->upload($asset, ['photo' => $this->photo()])->assertCreated();

        app(AssetLabelService::class)->markReprintRequired($asset->fresh(), 'TEST');
        $this->assertSame('reprint_required', $asset->fresh()->label_status);
        $this->printLabel($asset);

        $this->assertSame('printed', $asset->fresh()->label_status);
        $this->assertSame(1, AssetLabel::where('asset_id', $asset->id)->whereIn('status', AssetLabel::LIVE_STATUSES)->count());
        $this->getJson('/api/v1/assets/'.$asset->id.'/label-evidence')
            ->assertOk()
            ->assertJsonPath('data.label.label_version', 2)
            ->assertJsonPath('data.label.photo', null);
        $this->getJson('/api/v1/assets/labels/awaiting-photo')->assertOk()->assertJsonPath('data.0.id', $asset->id);
    }

    public function test_rejects_non_images_and_unprinted_labels(): void
    {
        $tenant = Tenant::factory()->create();
        $asset = $this->laptop($tenant);
        Sanctum::actingAs($this->printer($tenant));

        $this->upload($asset, ['photo' => $this->photo()])->assertStatus(422);

        $this->printLabel($asset);
        $pdfNamedJpeg = UploadedFile::fake()->createWithContent('label.jpg', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
        $this->upload($asset, ['photo' => $pdfNamedJpeg])->assertStatus(422);
        $this->assertSame('printed', $asset->fresh()->label_status);
    }

    public function test_requires_print_permission_and_same_tenant(): void
    {
        $tenant = Tenant::factory()->create();
        $asset = $this->laptop($tenant);
        Sanctum::actingAs($this->printer($tenant));
        $this->printLabel($asset);

        $viewer = $this->makeUser('staff', $tenant);
        $viewer->givePermissionTo(['assets.view']);
        Sanctum::actingAs($viewer);
        $this->upload($asset, ['photo' => $this->photo()])->assertForbidden();

        Sanctum::actingAs($this->printer(Tenant::factory()->create()));
        $this->upload($asset, ['photo' => $this->photo()])->assertNotFound();
        $this->getJson('/api/v1/assets/'.$asset->id.'/label-evidence')->assertNotFound();

        $this->assertNull(AssetLabel::where('asset_id', $asset->id)->value('applied_at'));
    }

    public function test_scan_offers_photograph_label_once_printed(): void
    {
        $tenant = Tenant::factory()->create();
        $asset = $this->laptop($tenant);
        Sanctum::actingAs($this->printer($tenant));
        $this->printLabel($asset);

        $actions = collect($this->getJson('/api/v1/assets/qr/'.$asset->fresh()->qr_token)
            ->assertOk()
            ->json('data.allowed_actions'))->pluck('href', 'key');

        $this->assertSame('/assets/'.$asset->id.'?label=photo', $actions['photograph_label'] ?? null);
    }
}
