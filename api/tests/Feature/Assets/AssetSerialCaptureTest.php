<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetTimelineEvent;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssetSerialCaptureTest extends TestCase
{
    private function setUpRegister(): array
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        AssetCategory::create(['tenant_id' => $tenant->id, 'name' => 'IT', 'code' => 'it']);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-0098',
            'tag_number' => 'CE-0098',
            'name' => 'Laptop HP ProBook',
            'category' => 'it',
            'status' => 'active',
            'label_status' => 'printed',
        ]);

        return [$tenant, $admin, $asset];
    }

    private function editPayload(Asset $asset, array $extra = []): array
    {
        return array_merge([
            'asset_code' => $asset->asset_code,
            'name' => $asset->name,
            'category' => $asset->category,
            'status' => 'active',
        ], $extra);
    }

    public function test_edit_records_serial_make_model_and_queues_label_reprint(): void
    {
        [, $admin, $asset] = $this->setUpRegister();
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset, [
            'serial_number' => '  5CD144HSKY ',
            'manufacturer' => 'HP',
            'model' => 'ProBook 450 G8',
        ]))->assertOk()
            ->assertJsonPath('serial_number', '5CD144HSKY')
            ->assertJsonPath('manufacturer', 'HP')
            ->assertJsonPath('model', 'ProBook 450 G8')
            ->assertJsonPath('label_status', 'reprint_required');

        $this->assertTrue(AssetTimelineEvent::where('asset_id', $asset->id)->where('event_type', 'IDENTIFIERS_UPDATED')->exists());
        $this->getJson('/api/v1/assets/labels/reprint-queue')
            ->assertOk()
            ->assertJsonPath('data.0.id', $asset->id);
    }

    public function test_edit_without_serial_keeps_existing_serial_and_blank_clears_it(): void
    {
        [, $admin, $asset] = $this->setUpRegister();
        $asset->update(['serial_number' => 'ABC12345', 'label_status' => 'never_printed']);
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset, ['name' => 'Renamed']))
            ->assertOk()
            ->assertJsonPath('serial_number', 'ABC12345')
            ->assertJsonPath('label_status', 'never_printed');

        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset, ['serial_number' => '']))
            ->assertOk()
            ->assertJsonPath('serial_number', null);
    }

    public function test_duplicate_serial_is_rejected_unless_overridden(): void
    {
        [$tenant, $admin, $asset] = $this->setUpRegister();
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-0097',
            'name' => 'Other laptop',
            'category' => 'it',
            'status' => 'active',
            'serial_number' => 'DUP-0001',
        ]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset, ['serial_number' => 'DUP-0001']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('serial_number');
        $this->assertNull($asset->fresh()->serial_number);

        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset, [
            'serial_number' => 'DUP-0001',
            'allow_serial_duplicate' => true,
        ]))->assertOk()
            ->assertJsonPath('serial_number', 'DUP-0001')
            ->assertJsonPath('serial_duplicate_override', true);
    }

    public function test_create_accepts_serial_and_checks_duplicates(): void
    {
        [, $admin, $asset] = $this->setUpRegister();
        $asset->update(['serial_number' => 'TAKEN-001']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/assets', [
            'asset_code' => 'CE-0200',
            'name' => 'Monitor',
            'category' => 'it',
            'serial_number' => 'TAKEN-001',
        ])->assertStatus(422)->assertJsonValidationErrors('serial_number');

        $this->postJson('/api/v1/assets', [
            'asset_code' => 'CE-0200',
            'name' => 'Monitor',
            'category' => 'it',
            'serial_number' => 'MON-777',
            'manufacturer' => 'Dell',
            'model' => 'P2422H',
        ])->assertCreated()
            ->assertJsonPath('serial_number', 'MON-777')
            ->assertJsonPath('model', 'P2422H');
    }

    public function test_identifiers_patch_only_touches_sent_fields_and_worklist_filters_missing_serials(): void
    {
        [$tenant, $admin, $asset] = $this->setUpRegister();
        $asset->update(['model' => 'ProBook 450 G8']);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-0050',
            'name' => 'Desktop',
            'category' => 'it',
            'status' => 'active',
            'serial_number' => 'HAS-SERIAL-1',
        ]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/assets?serial=missing')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $asset->id);

        $this->patchJson('/api/v1/assets/'.$asset->id.'/identifiers', ['serial_number' => '5CD144HSKY'])
            ->assertOk()
            ->assertJsonPath('serial_number', '5CD144HSKY')
            ->assertJsonPath('model', 'ProBook 450 G8')
            ->assertJsonPath('name', 'Laptop HP ProBook')
            ->assertJsonPath('label_status', 'reprint_required');

        $this->getJson('/api/v1/assets?serial=missing')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/assets?serial=present')->assertOk()->assertJsonCount(2, 'data');

        $this->patchJson('/api/v1/assets/'.$asset->id.'/identifiers', ['serial_number' => 'HAS-SERIAL-1'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('serial_number');
    }

    public function test_identifiers_patch_is_tenant_scoped_and_needs_manage_permission(): void
    {
        [$tenant, , $asset] = $this->setUpRegister();

        Sanctum::actingAs($this->makeUser('staff', $tenant));
        $this->patchJson('/api/v1/assets/'.$asset->id.'/identifiers', ['serial_number' => 'X12345'])->assertForbidden();

        Sanctum::actingAs($this->makeAdmin(Tenant::factory()->create()));
        $this->patchJson('/api/v1/assets/'.$asset->id.'/identifiers', ['serial_number' => 'X12345'])->assertNotFound();

        $this->assertNull($asset->fresh()->serial_number);
    }

    public function test_edit_accepts_invited_assignee_and_resave_keeps_current_assignee(): void
    {
        [$tenant, $admin, $asset] = $this->setUpRegister();
        $invited = $this->makeUser('staff', $tenant);
        $invited->forceFill(['is_active' => false, 'account_status' => User::STATUS_INVITED])->save();
        Sanctum::actingAs($admin);

        // The assignee picker lists invited people, so the edit form must accept them.
        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset, ['assigned_to' => $invited->id]))
            ->assertOk()
            ->assertJsonPath('assigned_to', $invited->id);

        // Re-saving with the same assignee is not a new assignment, even if they were deactivated since.
        $invited->forceFill(['account_status' => User::STATUS_SUSPENDED])->save();
        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset->fresh(), [
            'assigned_to' => $invited->id,
            'name' => 'Laptop HP ProBook 450',
        ]))->assertOk()->assertJsonPath('name', 'Laptop HP ProBook 450');

        // A deactivated person still cannot be newly assigned.
        $other = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-0099',
            'name' => 'Spare laptop',
            'category' => 'it',
            'status' => 'active',
        ]);
        $this->putJson('/api/v1/assets/'.$other->id, $this->editPayload($other, ['assigned_to' => $invited->id]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('assigned_to');
    }

    public function test_staff_cannot_set_serial(): void
    {
        [$tenant, , $asset] = $this->setUpRegister();
        Sanctum::actingAs($this->makeUser('staff', $tenant));

        $this->putJson('/api/v1/assets/'.$asset->id, $this->editPayload($asset, ['serial_number' => 'X12345']))
            ->assertForbidden();
        $this->assertNull($asset->fresh()->serial_number);
    }
}
