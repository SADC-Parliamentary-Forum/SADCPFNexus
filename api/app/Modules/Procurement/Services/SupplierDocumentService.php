<?php

namespace App\Modules\Procurement\Services;

use App\Models\SupplierApprovalLog;
use App\Models\SupplierDocument;
use App\Models\SupplierDocumentRequirementType;
use App\Models\User;
use App\Models\Vendor;
use App\Support\UploadContentSniffer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SupplierDocumentService
{
    public function __construct(
        private readonly SupplierCatalogueSeeder $catalogue,
    ) {}

    public function storeForVendor(
        Vendor $vendor,
        UploadedFile $file,
        string $typeCode,
        User $actor,
        array $meta = []
    ): SupplierDocument {
        $this->catalogue->ensureForTenant((int) $vendor->tenant_id);

        $type = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('code', $typeCode)
            ->where('is_active', true)
            ->first();

        if (! $type) {
            throw ValidationException::withMessages([
                'type_code' => ['Unknown document requirement type.'],
            ]);
        }

        $mime = UploadContentSniffer::assertAllowed($file);
        $path = $file->store('attachments/vendors/'.$vendor->id.'/register', ['disk' => 'local']);

        $current = SupplierDocument::query()
            ->where('vendor_id', $vendor->id)
            ->where('type_code', $typeCode)
            ->where('is_current', true)
            ->first();

        $version = $current ? ((int) $current->version + 1) : 1;
        if ($current) {
            $current->update(['is_current' => false]);
        }

        $document = SupplierDocument::create([
            'tenant_id' => $vendor->tenant_id,
            'vendor_id' => $vendor->id,
            'requirement_type_id' => $type->id,
            'type_code' => $type->code,
            'name' => $meta['name'] ?? $file->getClientOriginalName(),
            'document_number' => $meta['document_number'] ?? null,
            'issuing_authority' => $meta['issuing_authority'] ?? null,
            'issue_date' => $meta['issue_date'] ?? null,
            'expiry_date' => $meta['expiry_date'] ?? null,
            'original_filename' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
            'version' => $version,
            'status' => SupplierDocument::STATUS_PENDING,
            'replaces_document_id' => $current?->id,
            'is_current' => true,
            'uploaded_by' => $actor->id,
        ]);

        $vendor->attachments()->create([
            'tenant_id' => $vendor->tenant_id,
            'uploaded_by' => $actor->id,
            'document_type' => $type->code,
            'original_filename' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => $file->getSize(),
            'expires_at' => $meta['expiry_date'] ?? null,
        ]);

        return $document;
    }

    public function verify(SupplierDocument $document, User $officer, ?string $remarks = null): SupplierDocument
    {
        $this->assertTenant($document, $officer);

        $document->fill([
            'status' => SupplierDocument::STATUS_VERIFIED,
            'verified_by' => $officer->id,
            'verified_at' => now(),
            'remarks' => $remarks,
        ]);
        $document->save();

        SupplierApprovalLog::create([
            'tenant_id' => $document->tenant_id,
            'vendor_id' => $document->vendor_id,
            'action' => 'document_verified',
            'reason' => $remarks,
            'metadata' => [
                'document_id' => $document->id,
                'type_code' => $document->type_code,
                'version' => $document->version,
            ],
            'performed_by' => $officer->id,
            'performed_at' => now(),
        ]);

        return $document->fresh();
    }

    public function reject(SupplierDocument $document, User $officer, string $remarks): SupplierDocument
    {
        $this->assertTenant($document, $officer);

        $document->fill([
            'status' => SupplierDocument::STATUS_REJECTED,
            'verified_by' => $officer->id,
            'verified_at' => now(),
            'remarks' => $remarks,
        ]);
        $document->save();

        SupplierApprovalLog::create([
            'tenant_id' => $document->tenant_id,
            'vendor_id' => $document->vendor_id,
            'action' => 'document_rejected',
            'reason' => $remarks,
            'metadata' => [
                'document_id' => $document->id,
                'type_code' => $document->type_code,
                'version' => $document->version,
            ],
            'performed_by' => $officer->id,
            'performed_at' => now(),
        ]);

        return $document->fresh();
    }

    public function downloadPath(SupplierDocument $document): ?string
    {
        if ($document->storage_path && Storage::disk('local')->exists($document->storage_path)) {
            return $document->storage_path;
        }

        if ($document->attachment && $document->attachment->storage_path && Storage::disk('local')->exists($document->attachment->storage_path)) {
            return $document->attachment->storage_path;
        }

        return null;
    }

    private function assertTenant(SupplierDocument $document, User $officer): void
    {
        if ((int) $document->tenant_id !== (int) $officer->tenant_id) {
            abort(404);
        }
    }
}
