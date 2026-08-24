<?php

namespace Tests\Feature\Correspondence;

use App\Models\Correspondence;
use App\Models\Tenant;
use Tests\TestCase;

class CorrespondenceRegistryPackTest extends TestCase
{
    public function test_registry_pack_is_a_checklist_and_does_not_claim_live_courier(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $user->givePermissionTo(['correspondence.view', 'correspondence.registry']);

        $letter = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Plenary invitations',
            'subject' => 'Plenary invitations',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'draft',
            'file_code' => 'CS-01',
            'confidentiality' => 'general_official',
        ]);

        $pack = $http->getJson('/api/v1/correspondence/letters/'.$letter->id.'/registry-pack')
            ->assertOk()
            ->json('data');

        $this->assertTrue($pack['courier_is_stub']);
        $this->assertFalse($pack['live_courier']);
        $keys = collect($pack['checklist'])->pluck('key')->all();
        $this->assertContains('file_code', $keys);
        $this->assertContains('live_courier_configured', $keys);
        $detected = collect($pack['checklist'])->firstWhere('key', 'file_code');
        $this->assertTrue((bool) $detected['detected']);
        $this->assertStringContainsString('not live carrier proof', strtolower($pack['note']));
        $this->assertArrayHasKey('subject_files', $pack);
        $this->assertArrayHasKey('filing_notes', $pack);
    }
}
