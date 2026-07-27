<?php

namespace Tests\Feature\Leave;

use App\Models\Attachment;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LeaveMedicalDocumentAccessTest extends TestCase
{
    private function leaveWithDocuments(Tenant $tenant, int $ownerId): array
    {
        Storage::fake('local');

        $leave = LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $ownerId,
            'reference_number' => 'LV-MED-' . uniqid(),
            'leave_type' => 'sick',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(7)->toDateString(),
            'days_requested' => 3,
            'reason' => 'Sick leave',
            'status' => 'submitted',
        ]);

        Storage::disk('local')->put("attachments/leave/{$leave->id}/medical.pdf", 'medical');
        Storage::disk('local')->put("attachments/leave/{$leave->id}/handover.pdf", 'handover');

        $medical = $leave->attachments()->create([
            'tenant_id' => $tenant->id,
            'uploaded_by' => $ownerId,
            'document_type' => Attachment::DOCUMENT_TYPE_MEDICAL_CERTIFICATE,
            'original_filename' => 'medical.pdf',
            'storage_path' => "attachments/leave/{$leave->id}/medical.pdf",
            'mime_type' => 'application/pdf',
            'size_bytes' => 7,
        ]);

        $supporting = $leave->attachments()->create([
            'tenant_id' => $tenant->id,
            'uploaded_by' => $ownerId,
            'document_type' => Attachment::DOCUMENT_TYPE_LEAVE_SUPPORTING,
            'original_filename' => 'handover.pdf',
            'storage_path' => "attachments/leave/{$leave->id}/handover.pdf",
            'mime_type' => 'application/pdf',
            'size_bytes' => 8,
        ]);

        return [$leave, $medical, $supporting];
    }

    public function test_hod_can_see_supporting_documents_but_not_medical_certificates(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $hod = $this->makeUser('HOD', $tenant);
        [$leave, $medical, $supporting] = $this->leaveWithDocuments($tenant, $owner->id);

        $this->asUser($hod)
            ->getJson("/api/v1/leave/requests/{$leave->id}/attachments")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $supporting->id);

        $this->asUser($hod)
            ->get("/api/v1/leave/requests/{$leave->id}/attachments/{$medical->id}/download")
            ->assertForbidden();
    }

    public function test_hr_can_download_medical_certificate(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $hr = $this->makeHrManager($tenant);
        [$leave, $medical] = $this->leaveWithDocuments($tenant, $owner->id);

        $this->asUser($hr)
            ->getJson("/api/v1/leave/requests/{$leave->id}/attachments")
            ->assertOk()
            ->assertJsonFragment(['id' => $medical->id]);

        $this->asUser($hr)
            ->get("/api/v1/leave/requests/{$leave->id}/attachments/{$medical->id}/download")
            ->assertOk();
    }

    public function test_owner_can_download_own_medical_certificate(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        [$leave, $medical] = $this->leaveWithDocuments($tenant, $owner->id);

        $this->asUser($owner)
            ->get("/api/v1/leave/requests/{$leave->id}/attachments/{$medical->id}/download")
            ->assertOk();
    }

    public function test_system_admin_role_alone_cannot_download_medical_certificate(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $admin = $this->makeAdmin($tenant);
        [$leave, $medical] = $this->leaveWithDocuments($tenant, $owner->id);

        $this->asUser($admin)
            ->get("/api/v1/leave/requests/{$leave->id}/attachments/{$medical->id}/download")
            ->assertForbidden();
    }
}
