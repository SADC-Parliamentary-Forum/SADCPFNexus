<?php

namespace Tests\Feature\Workflow;

use App\Models\ApprovalWorkflow;
use App\Models\PurchaseOrder;
use App\Models\SignatureEvent;
use App\Models\SignatureProfile;
use App\Models\SignatureVersion;
use App\Models\SignedActionToken;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use App\Modules\Procurement\Services\LpoPdfService;
use App\Services\SaamService;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WorkflowSignatureStampTest extends TestCase
{
    private function pngBytes(): string
    {
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    }

    private function enrolSpecimen(User $user): SignatureVersion
    {
        Storage::fake('local');
        $stored = app(SaamService::class)->storeSignatureImage(
            'data:image/png;base64,'.base64_encode($this->pngBytes()),
            (int) $user->tenant_id,
            (int) $user->id,
        );

        return app(SaamService::class)->upsertProfile((int) $user->tenant_id, (int) $user->id, 'full', $stored['path'], $stored['hash']);
    }

    /**
     * @return array{0: Tenant, 1: User, 2: PurchaseOrder, 3: \App\Models\ApprovalRequest}
     */
    private function seedSigningLpo(bool $requiresSignature = true): array
    {
        Queue::fake();
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $sg = $this->makeSG($tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Test Supplies',
            'is_approved' => true,
            'is_active' => true,
        ]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'vendor_id' => $vendor->id,
            'title' => 'Stationery LPO',
            'total_amount' => 1500,
            'currency' => 'NAD',
            'status' => 'submitted',
            'created_by' => $staff->id,
        ]);

        $workflow = ApprovalWorkflow::create([
            'tenant_id' => $tenant->id,
            'name' => 'LPO SAAM Test',
            'module_type' => 'purchase_order',
            'is_active' => true,
        ]);
        $workflow->steps()->create([
            'step_order' => 0,
            'step_name' => 'SG / Authorised Signatory',
            'approver_type' => 'specific_user',
            'actor_selector' => 'specific_user',
            'user_id' => $sg->id,
            'stage_type' => 'approve',
            'requires_signature' => $requiresSignature,
        ]);

        $approval = app(WorkflowService::class)->initiate($po, 'purchase_order', $staff);
        $this->assertNotNull($approval);

        return [$tenant, $sg, $po, $approval->fresh()];
    }

    public function test_signing_step_rejects_approve_without_password(): void
    {
        [, $sg, , $approval] = $this->seedSigningLpo();

        $this->asUser($sg)->postJson("/api/v1/approvals/{$approval->id}/approve", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['confirm_password']);

        $this->assertDatabaseMissing('signature_events', [
            'signable_id' => $approval->approvable_id,
            'signer_user_id' => $sg->id,
        ]);
    }

    public function test_signing_step_rejects_missing_specimen(): void
    {
        [, $sg, , $approval] = $this->seedSigningLpo();

        $this->asUser($sg)->postJson("/api/v1/approvals/{$approval->id}/approve", [
            'confirm_password' => 'password',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['signature']);
    }

    public function test_signing_step_records_event_and_stamps_lpo_html(): void
    {
        [, $sg, $po, $approval] = $this->seedSigningLpo();
        $version = $this->enrolSpecimen($sg);

        $this->asUser($sg)->postJson("/api/v1/approvals/{$approval->id}/approve", [
            'confirm_password' => 'password',
            'comment' => 'Authorised',
        ])->assertOk();

        $event = SignatureEvent::where('signable_type', PurchaseOrder::class)
            ->where('signable_id', $po->id)
            ->first();
        $this->assertNotNull($event);
        $this->assertSame($version->id, (int) $event->signature_version_id);
        $this->assertSame('password', $event->auth_level);
        $this->assertNotEmpty($event->document_hash);

        $html = view('pdf.lpo', [
            'po' => $po->fresh()->load([
                'vendor', 'items', 'procurementRequest.requester', 'createdBy',
                'approvalRequest.history.user',
            ]),
            'letterhead' => ['org_name' => 'SADC Parliamentary Forum'],
            'generatedAt' => now(),
            'signatureStamps' => app(LpoPdfService::class)->signatureStamps($po->fresh()),
        ])->render();

        $this->assertStringContainsString('data:image/png;base64,', $html);
        $this->assertStringNotContainsString('>Approved in Nexus<', $html);
    }

    public function test_email_approve_of_signing_step_is_rejected_without_consuming_token(): void
    {
        [, $sg, , $approval] = $this->seedSigningLpo();
        $this->enrolSpecimen($sg);

        $token = bin2hex(random_bytes(32));
        SignedActionToken::create([
            'tenant_id' => $sg->tenant_id,
            'approval_request_id' => $approval->id,
            'approver_user_id' => $sg->id,
            'token' => $token,
            'action' => 'approve',
            'expires_at' => now()->addHours(72),
        ]);

        $this->asUser($sg)->postJson('/api/v1/email-action/process', [
            'token' => $token,
            'action' => 'approve',
            'use_signature' => true,
        ])->assertStatus(422)
            ->assertJsonPath('reason', 'requires_signature');

        $this->assertNull(SignedActionToken::where('token', $token)->first()?->used_at);
        $this->assertSame('pending', $approval->fresh()->status);
    }

    public function test_unsigned_step_still_approves_without_password(): void
    {
        [, $sg, , $approval] = $this->seedSigningLpo(false);

        $this->asUser($sg)->postJson("/api/v1/approvals/{$approval->id}/approve", [])
            ->assertOk();

        $this->assertDatabaseMissing('signature_events', [
            'signer_user_id' => $sg->id,
            'signable_id' => $approval->approvable_id,
        ]);
    }
}
