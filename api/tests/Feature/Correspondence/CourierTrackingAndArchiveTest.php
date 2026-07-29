<?php

namespace Tests\Feature\Correspondence;

use App\Models\Correspondence;
use App\Models\CorrespondenceDispatch;
use App\Models\Tenant;
use Tests\TestCase;

class CourierTrackingAndArchiveTest extends TestCase
{
    public function test_refresh_tracking_stub_and_archive_import(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $letter = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'registered_by' => $user->id,
            'registered_at' => now(),
            'title' => 'Courier letter',
            'subject' => 'Courier letter',
            'type' => 'external',
            'direction' => 'outgoing',
            'status' => 'sent',
            'language' => 'en',
            'confidentiality' => 'general_official',
        ]);

        $dispatch = CorrespondenceDispatch::create([
            'correspondence_id' => $letter->id,
            'dispatched_by' => $user->id,
            'channel' => 'courier',
            'dispatched_at' => now()->subHours(20),
            'tracking_number' => 'TRK-123',
            'courier_carrier' => 'stub',
        ]);

        $http->postJson("/api/v1/correspondence/dispatches/{$dispatch->id}/refresh-tracking")
            ->assertOk()
            ->assertJsonPath('data.tracking_status', 'in_transit');

        $import = $http->postJson('/api/v1/correspondence/archive/import', [
            'rows' => [[
                'reference' => 'ARC-FR-1',
                'subject' => 'Archive FR',
                'language' => 'fr',
                'language_tags' => ['fr', 'en'],
                'body' => 'Bonjour',
            ]],
        ])->assertCreated()->json('data');

        $this->assertSame(1, (int) $import['imported']);
        $this->assertDatabaseHas('correspondence', [
            'reference_number' => 'ARC-FR-1',
            'language' => 'fr',
        ]);
    }
}