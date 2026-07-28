<?php

namespace Tests\Feature\Correspondence;

use App\Models\Correspondence;
use App\Models\CorrespondenceReferenceLedger;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class CorrespondenceRegisterPhase1Test extends TestCase
{
    private function grantRegistry(User $user): void
    {
        $user->givePermissionTo([
            'correspondence.view',
            'correspondence.create',
            'correspondence.registry',
            'correspondence.route',
            'correspondence.approve',
            'correspondence.send',
            'correspondence.dispatch',
            'correspondence.review',
            'correspondence.confidential.view',
        ]);
    }

    public function test_incoming_references_are_unique_and_sequential(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->grantRegistry($user);

        $a = $http->postJson('/api/v1/correspondence/letters/incoming/register', [
            'title' => 'Letter A',
            'subject' => 'Subject A',
            'sender_name' => 'Parliament X',
        ])->assertCreated()->json('data');

        $b = $http->postJson('/api/v1/correspondence/letters/incoming/register', [
            'title' => 'Letter B',
            'subject' => 'Subject B',
            'sender_name' => 'Ministry Y',
        ])->assertCreated()->json('data');

        $this->assertNotEquals($a['registry_reference'], $b['registry_reference']);
        $this->assertSame(2, CorrespondenceReferenceLedger::where('tenant_id', $tenant->id)->where('direction', 'incoming')->count());
    }

    public function test_voided_outgoing_reference_is_never_reused(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->grantRegistry($user);
        $sg = $this->makeSG($tenant);
        $sg->givePermissionTo(['correspondence.approve', 'correspondence.view', 'correspondence.route']);

        $letter = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Outgoing',
            'subject' => 'Outgoing Subject',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'pending_approval',
            'file_code' => '123',
            'signatory_code' => 'SG',
            'confidentiality' => 'general_official',
        ]);

        $approved = $this->actingAs($sg, 'sanctum')
            ->postJson("/api/v1/correspondence/letters/{$letter->id}/approve")
            ->assertOk()
            ->json('data');

        $ref = $approved['reference_number'];
        $this->assertNotEmpty($ref);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/correspondence/letters/{$letter->id}/void-reference", [
                'reason' => 'Abandoned after approval',
            ])
            ->assertOk();

        $this->assertDatabaseHas('correspondence_reference_ledger', [
            'tenant_id' => $tenant->id,
            'reference' => $ref,
            'status' => 'voided',
        ]);

        $letter2 = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Outgoing 2',
            'subject' => 'Outgoing Subject 2',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'pending_approval',
            'file_code' => '123',
            'signatory_code' => 'SG',
            'confidentiality' => 'general_official',
        ]);

        $approved2 = $this->actingAs($sg, 'sanctum')
            ->postJson("/api/v1/correspondence/letters/{$letter2->id}/approve")
            ->assertOk()
            ->json('data');

        $this->assertNotEquals($ref, $approved2['reference_number']);
        $this->assertSame(1, CorrespondenceReferenceLedger::where('reference', $ref)->count());
    }

    public function test_sg_routing_requires_primary_owner_for_action(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->grantRegistry($user);
        $owner = User::factory()->create(['tenant_id' => $tenant->id]);

        $incoming = $http->postJson('/api/v1/correspondence/letters/incoming/register', [
            'title' => 'Invite',
            'subject' => 'Conference invite',
            'sender_name' => 'SADC',
        ])->assertCreated()->json('data');

        $sg = $this->makeSG($tenant);
        $sg->givePermissionTo(['correspondence.route', 'correspondence.view']);

        $this->actingAs($sg, 'sanctum')
            ->postJson("/api/v1/correspondence/letters/{$incoming['id']}/sg-route", [
                'action' => 'route_for_action',
                'instruction' => 'Please advise',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['primary_owner_id']);

        $routed = $this->actingAs($sg, 'sanctum')
            ->postJson("/api/v1/correspondence/letters/{$incoming['id']}/sg-route", [
                'action' => 'route_for_action',
                'primary_owner_id' => $owner->id,
                'supporting_owner_ids' => [],
                'instruction' => 'Prepare recommendation',
                'due_date' => now()->addDays(7)->toDateString(),
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame($owner->id, $routed['primary_owner_id']);
        $this->assertSame('in_progress', $routed['status']);
        $this->assertDatabaseHas('correspondence_owners', [
            'correspondence_id' => $incoming['id'],
            'user_id' => $owner->id,
            'role' => 'primary',
        ]);
    }

    public function test_dispatch_blocked_before_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->grantRegistry($user);

        $letter = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Draft out',
            'subject' => 'Draft',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'draft',
            'confidentiality' => 'general_official',
        ]);

        $http->postJson("/api/v1/correspondence/letters/{$letter->id}/dispatch", [
            'channel' => 'post',
        ])->assertUnprocessable();
    }

    public function test_registered_original_and_signed_final_are_immutable(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->grantRegistry($user);

        $incoming = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'registered_by' => $user->id,
            'registered_at' => now(),
            'title' => 'Scanned',
            'subject' => 'Scanned mail',
            'type' => 'external',
            'direction' => 'incoming',
            'status' => 'pending_sg_routing',
            'sender_name' => 'Embassy',
            'confidentiality' => 'general_official',
            'file_path' => 'correspondence/1/registered/scan.pdf',
            'original_filename' => 'scan.pdf',
            'original_immutable_at' => now(),
        ]);

        $this->assertTrue($incoming->isOriginalImmutable());

        $service = app(\App\Modules\Correspondence\Services\CorrespondenceRegisterService::class);
        try {
            $service->assertMutable($incoming, true);
            $this->fail('Expected immutability validation');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertArrayHasKey('file', $e->errors());
        }

        $outgoing = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'To sign',
            'subject' => 'To sign',
            'body' => 'Body',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'approved',
            'file_code' => '123',
            'signatory_code' => 'SG',
            'approved_by' => $user->id,
            'approved_at' => now(),
            'confidentiality' => 'general_official',
        ]);

        $signed = $http->postJson("/api/v1/correspondence/letters/{$outgoing->id}/sign")
            ->assertOk()
            ->json('data');

        $this->assertNotNull($signed['signed_immutable_at']);
        $this->assertSame('ready_dispatch', $signed['status']);

        try {
            $service->assertMutable(Correspondence::find($outgoing->id));
            $this->fail('Expected signed immutability');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertArrayHasKey('status', $e->errors());
        }
    }

    public function test_confidentiality_hides_from_unauthorized_search(): void
    {
        $tenant = Tenant::factory()->create();
        [$httpRegistry, $registry] = $this->asStaff($tenant);
        $this->grantRegistry($registry);

        $outsider = User::factory()->create(['tenant_id' => $tenant->id]);
        $outsider->assignRole('staff');
        $outsider->givePermissionTo(['correspondence.view', 'correspondence.create']);

        $secret = $httpRegistry->postJson('/api/v1/correspondence/letters/incoming/register', [
            'title' => 'SECRET-XYZ-TOKEN',
            'subject' => 'SECRET-XYZ-TOKEN',
            'sender_name' => 'Private',
            'confidentiality' => 'confidential',
            'content_restricted' => true,
        ])->assertCreated()->json('data');

        $list = $this->actingAs($outsider, 'sanctum')
            ->getJson('/api/v1/correspondence/letters?search=SECRET-XYZ-TOKEN')
            ->assertOk()
            ->json('data');

        $ids = collect($list)->pluck('id')->all();
        $this->assertNotContains($secret['id'], $ids);

        $this->actingAs($outsider, 'sanctum')
            ->getJson("/api/v1/correspondence/letters/{$secret['id']}")
            ->assertForbidden();
    }

    public function test_thread_relationship_links_records(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->grantRegistry($user);

        $incoming = $http->postJson('/api/v1/correspondence/letters/incoming/register', [
            'title' => 'Original',
            'subject' => 'Original subject',
            'sender_name' => 'Sender',
        ])->assertCreated()->json('data');

        $reply = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Reply',
            'subject' => 'RE: Original subject',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'draft',
            'confidentiality' => 'general_official',
        ]);

        $http->postJson("/api/v1/correspondence/letters/{$reply->id}/relationships", [
            'to_correspondence_id' => $incoming['id'],
            'type' => 'response_to',
        ])->assertCreated();

        $this->assertDatabaseHas('correspondence_relationships', [
            'from_correspondence_id' => $reply->id,
            'to_correspondence_id' => $incoming['id'],
            'type' => 'response_to',
        ]);

        $this->assertSame((int) $incoming['id'], (int) $reply->fresh()->thread_root_id);
    }

    public function test_external_payload_excludes_internal_notes(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->grantRegistry($user);

        $c = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Letter',
            'subject' => 'Public subject',
            'body' => 'Public body',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'approved',
            'confidentiality' => 'general_official',
        ]);

        $http->postJson("/api/v1/correspondence/letters/{$c->id}/notes", [
            'body' => 'INTERNAL ONLY — do not leak',
        ])->assertCreated();

        $payload = $c->fresh()->externalPayload();
        $this->assertArrayNotHasKey('notes', $payload);
        $json = json_encode($payload);
        $this->assertStringNotContainsString('INTERNAL ONLY', $json);
    }
}
