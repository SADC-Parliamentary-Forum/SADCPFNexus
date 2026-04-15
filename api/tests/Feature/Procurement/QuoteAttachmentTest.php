<?php

namespace Tests\Feature\Procurement;

use App\Models\Attachment;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class QuoteAttachmentTest extends TestCase
{
    private function makeRequest(Tenant $tenant, int $requesterId): ProcurementRequest
    {
        return ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requesterId,
            'title' => 'ICT Equipment RFQ',
            'description' => 'Collect supplier quotations for laptops.',
            'category' => 'goods',
            'estimated_value' => 45000,
            'currency' => 'NAD',
            'status' => 'approved',
            'submitted_at' => now()->subDay(),
            'approved_at' => now(),
            'rfq_issued_at' => now()->subHours(4),
        ]);
    }

    private function makeQuote(ProcurementRequest $request): ProcurementQuote
    {
        return $request->quotes()->create([
            'vendor_name' => 'TechSupply Ltd',
            'quoted_amount' => 42000,
            'currency' => 'NAD',
            'submission_channel' => 'internal',
            'quote_date' => now()->toDateString(),
        ]);
    }

    public function test_procurement_officer_can_upload_quote_attachment(): void
    {
        Storage::fake('local');

        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $request = $this->makeRequest($tenant, $requester->id);
        $quote = $this->makeQuote($request);

        [$http] = $this->asProcurementOfficer($tenant);

        $response = $http->post('/api/v1/procurement/requests/' . $request->id . '/quotes/' . $quote->id . '/attachments', [
            'file' => UploadedFile::fake()->create('submitted-quote.pdf', 120, 'application/pdf'),
            'document_type' => Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.document_type', Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED)
            ->assertJsonPath('data.original_filename', 'submitted-quote.pdf');

        $this->assertDatabaseHas('attachments', [
            'attachable_type' => ProcurementQuote::class,
            'attachable_id' => $quote->id,
            'document_type' => Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED,
            'original_filename' => 'submitted-quote.pdf',
        ]);

        $attachment = Attachment::query()->where('attachable_type', ProcurementQuote::class)->where('attachable_id', $quote->id)->firstOrFail();
        Storage::disk('local')->assertExists($attachment->storage_path);
    }

    public function test_can_list_quote_attachments(): void
    {
        Storage::fake('local');

        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $request = $this->makeRequest($tenant, $requester->id);
        $quote = $this->makeQuote($request);
        $uploader = $this->makeProcurementOfficer($tenant);

        $attachment = $quote->attachments()->create([
            'tenant_id' => $tenant->id,
            'uploaded_by' => $uploader->id,
            'document_type' => Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED,
            'original_filename' => 'existing-quote.pdf',
            'storage_path' => 'attachments/procurement-quotes/' . $quote->id . '/existing-quote.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
        ]);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->getJson('/api/v1/procurement/requests/' . $request->id . '/quotes/' . $quote->id . '/attachments')
            ->assertOk()
            ->assertJsonPath('data.0.id', $attachment->id)
            ->assertJsonPath('data.0.original_filename', 'existing-quote.pdf')
            ->assertJsonPath('data.0.uploader.id', $uploader->id);
    }

    public function test_staff_cannot_upload_quote_attachment(): void
    {
        Storage::fake('local');

        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $request = $this->makeRequest($tenant, $requester->id);
        $quote = $this->makeQuote($request);

        [$http] = $this->asStaff($tenant);

        $http->post('/api/v1/procurement/requests/' . $request->id . '/quotes/' . $quote->id . '/attachments', [
            'file' => UploadedFile::fake()->create('submitted-quote.pdf', 120, 'application/pdf'),
            'document_type' => Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED,
        ])->assertForbidden();
    }

    public function test_cannot_upload_attachment_to_quote_from_different_request(): void
    {
        Storage::fake('local');

        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $request = $this->makeRequest($tenant, $requester->id);
        $otherRequest = $this->makeRequest($tenant, $requester->id);
        $foreignQuote = $this->makeQuote($otherRequest);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->post('/api/v1/procurement/requests/' . $request->id . '/quotes/' . $foreignQuote->id . '/attachments', [
            'file' => UploadedFile::fake()->create('submitted-quote.pdf', 120, 'application/pdf'),
            'document_type' => Attachment::DOCUMENT_TYPE_QUOTE_RECEIVED,
        ])->assertNotFound();
    }
}
