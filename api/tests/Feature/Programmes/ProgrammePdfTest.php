<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammePdfTest extends TestCase
{
    public function test_pdf_can_be_downloaded_for_an_approved_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'PDF Test',
            'status' => 'approved', 'approved_at' => now(),
            'venue_country' => 'Namibia', 'venue_city' => 'Windhoek',
        ]);

        $response = $http->get("/api/v1/programmes/{$programme->id}/pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }
}
