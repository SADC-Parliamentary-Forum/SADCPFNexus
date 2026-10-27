<?php

namespace Tests\Feature\Documents;

use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\Programme;
use App\Models\ProgrammeDocument;
use App\Models\Risk;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use App\Support\AttachmentFiles;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

/**
 * Attachment upload/delete authorization, lifecycle locks and storage
 * consistency (codebase review 2026-10-27, Stage 3).
 */
class AttachmentAuthorizationTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(array $overrides = []): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V'.uniqid(), 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create(array_merge([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'title' => 'C',
            'start_date' => now()->subDay()->toDateString(), 'end_date' => now()->addDays(20)->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'currency' => 'USD',
            'contract_status' => 'DRAFT', 'status' => 'draft', 'signature_status' => 'unsigned',
        ], $overrides));
    }

    /** A tenant user holding exactly the given permissions and no role. */
    private function userWith(array $permissions): User
    {
        $user = User::factory()->create(['tenant_id' => $this->tenant->id]);
        if ($permissions !== []) {
            $user->givePermissionTo($permissions);
        }

        return $user;
    }

    private function attachTo($attachable): Attachment
    {
        Storage::disk('local')->put('attachments/test/doc.pdf', '%PDF-1.4 test');

        return $attachable->attachments()->create([
            'tenant_id' => $this->tenant->id,
            'uploaded_by' => $this->makeUser('staff', $this->tenant)->id,
            'document_type' => 'other',
            'original_filename' => 'doc.pdf',
            'storage_path' => 'attachments/test/doc.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 13,
        ]);
    }

    public function test_contract_attachment_mutations_require_contract_rights_on_the_unmapped_contracts_path(): void
    {
        $contract = $this->contract();
        $attachment = $this->attachTo($contract);
        // No procurement or contract rights at all: previously this path let
        // any authenticated tenant user upload and delete.
        $staff = $this->userWith([]);

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/contracts/{$contract->id}/attachments", ['file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf')])
            ->assertForbidden();
        $this->actingAs($staff, 'sanctum')
            ->deleteJson("/api/v1/contracts/{$contract->id}/attachments/{$attachment->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('attachments', ['id' => $attachment->id]);
    }

    public function test_documents_on_a_signed_contract_can_only_be_removed_by_an_administrator(): void
    {
        $contract = $this->contract(['contract_status' => 'ACTIVE', 'status' => 'active', 'signature_status' => 'signed']);
        $attachment = $this->attachTo($contract);

        // contract.edit_draft may remove documents before signing, not after.
        $this->actingAs($this->userWith(['contract.edit_draft']), 'sanctum')
            ->deleteJson("/api/v1/contracts/{$contract->id}/attachments/{$attachment->id}")
            ->assertStatus(422);
        $this->assertDatabaseHas('attachments', ['id' => $attachment->id]);

        $this->actingAs($this->makeUser('System Admin', $this->tenant), 'sanctum')
            ->deleteJson("/api/v1/contracts/{$contract->id}/attachments/{$attachment->id}")
            ->assertOk();
        $this->assertDatabaseMissing('attachments', ['id' => $attachment->id]);
        $this->assertTrue(AuditLog::where('event', 'contract.attachment_removed_after_signature')->where('auditable_id', $contract->id)->exists());
    }

    public function test_programme_document_from_another_programme_cannot_be_changed_through_this_programme(): void
    {
        [$http, $officer] = $this->asProgrammeOfficer($this->tenant);
        $mine = Programme::create(['tenant_id' => $this->tenant->id, 'created_by' => $officer->id, 'reference_number' => 'PIF-'.uniqid(), 'title' => 'Mine', 'status' => 'draft']);
        $other = Programme::create(['tenant_id' => $this->tenant->id, 'created_by' => $officer->id, 'reference_number' => 'PIF-'.uniqid(), 'title' => 'Other', 'status' => 'draft']);
        $foreignDoc = ProgrammeDocument::create(['programme_id' => $other->id, 'title' => 'Foreign', 'document_type' => 'agenda', 'owner_name' => 'X']);

        $http->putJson("/api/v1/programmes/{$mine->id}/documents/{$foreignDoc->id}", ['title' => 'Hijacked'])->assertNotFound();
        $http->deleteJson("/api/v1/programmes/{$mine->id}/documents/{$foreignDoc->id}")->assertNotFound();

        $this->assertSame('Foreign', $foreignDoc->fresh()->title);
    }

    public function test_evidence_on_a_submitted_risk_is_locked_for_non_admins(): void
    {
        $manager = $this->makeUser('Governance Officer', $this->tenant);
        $risk = Risk::create([
            'tenant_id' => $this->tenant->id, 'submitted_by' => $manager->id, 'title' => 'R', 'description' => 'D',
            'category' => 'operational', 'likelihood' => 2, 'impact' => 2, 'is_confidential' => false, 'status' => 'approved',
        ]);
        $attachment = $this->attachTo($risk);

        $this->actingAs($manager, 'sanctum')
            ->deleteJson("/api/v1/risk/risks/{$risk->id}/attachments/{$attachment->id}")
            ->assertStatus(422);
        $this->assertDatabaseHas('attachments', ['id' => $attachment->id]);
        Storage::disk('local')->assertExists('attachments/test/doc.pdf');

        // Draft risks stay editable: the same user may remove evidence.
        $risk->update(['status' => 'draft']);
        $this->actingAs($manager, 'sanctum')
            ->deleteJson("/api/v1/risk/risks/{$risk->id}/attachments/{$attachment->id}")
            ->assertOk();
        $this->assertDatabaseMissing('attachments', ['id' => $attachment->id]);
        Storage::disk('local')->assertMissing('attachments/test/doc.pdf');
    }

    public function test_a_failed_row_insert_removes_the_stored_file(): void
    {
        $file = UploadedFile::fake()->create('evidence.pdf', 5, 'application/pdf');

        try {
            AttachmentFiles::store($file, 'attachments/failing', function (string $path) {
                Storage::disk('local')->assertExists($path);
                throw new RuntimeException('insert failed');
            });
            $this->fail('Exception was swallowed');
        } catch (RuntimeException) {
        }

        $this->assertSame([], Storage::disk('local')->allFiles('attachments/failing'));
    }
}
