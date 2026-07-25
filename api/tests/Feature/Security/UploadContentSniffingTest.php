<?php

namespace Tests\Feature\Security;

use App\Models\Tenant;
use App\Models\TravelRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Content-sniffed uploads must reject non-allowlisted binary payloads.
 */
class UploadContentSniffingTest extends TestCase
{
    public function test_travel_attachment_rejects_disallowed_binary_payload(): void
    {
        Storage::fake('local');

        $tenant = Tenant::factory()->create();
        [$http, $owner] = $this->asStaff($tenant);

        $travel = TravelRequest::create([
            'tenant_id'           => $tenant->id,
            'requester_id'        => $owner->id,
            'reference_number'    => 'TRV-SNIFF-001',
            'purpose'             => 'Upload sniff test',
            'departure_date'      => now()->addDays(10)->toDateString(),
            'return_date'         => now()->addDays(12)->toDateString(),
            'destination_country' => 'Zambia',
            'status'              => 'draft',
        ]);

        $evil = UploadedFile::fake()->createWithContent('payload.bin', "\x00\x01\x02\x03\x04\x05");

        $http->post("/api/v1/travel/requests/{$travel->id}/attachments", [
            'file' => $evil,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_travel_attachment_accepts_plain_text_note(): void
    {
        Storage::fake('local');

        $tenant = Tenant::factory()->create();
        [$http, $owner] = $this->asStaff($tenant);

        $travel = TravelRequest::create([
            'tenant_id'           => $tenant->id,
            'requester_id'        => $owner->id,
            'reference_number'    => 'TRV-SNIFF-OK',
            'purpose'             => 'Upload sniff ok',
            'departure_date'      => now()->addDays(10)->toDateString(),
            'return_date'         => now()->addDays(12)->toDateString(),
            'destination_country' => 'Zambia',
            'status'              => 'draft',
        ]);

        $note = UploadedFile::fake()->createWithContent('note.txt', "mission notes\n");

        $http->post("/api/v1/travel/requests/{$travel->id}/attachments", [
            'file' => $note,
        ])->assertCreated();
    }
}
