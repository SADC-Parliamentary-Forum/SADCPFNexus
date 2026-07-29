<?php

namespace Tests\Feature\Travel;

use App\Models\Tenant;
use App\Models\TravelRequest;
use Tests\TestCase;

class TravelExportEditParityTest extends TestCase
{
    public function test_register_export_json_and_csv_include_rows(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'purpose' => 'Exportable mission',
            'destination_country' => 'Namibia',
            'destination_city' => 'Windhoek',
            'reference_number' => 'TRV-EXPORT-001',
        ]);

        $this->asUser($finance)
            ->getJson('/api/v1/travel/register/export')
            ->assertOk()
            ->assertJsonFragment(['purpose' => 'Exportable mission'])
            ->assertJsonFragment(['reference' => 'TRV-EXPORT-001']);

        $csv = $this->asUser($finance)
            ->get('/api/v1/travel/register/export?format=csv')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $body = $csv->getContent();
        $this->assertStringContainsString('reference', $body);
        $this->assertStringContainsString('Exportable mission', $body);
        $this->assertStringContainsString('TRV-EXPORT-001', $body);
    }

    public function test_register_export_search_filter_is_reliable(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'purpose' => 'Alpha mission unique',
            'destination_country' => 'Zambia',
        ]);
        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'purpose' => 'Beta other trip',
            'destination_country' => 'Malawi',
        ]);

        $this->asUser($finance)
            ->getJson('/api/v1/travel/register/export?search=Alpha')
            ->assertOk()
            ->assertJsonFragment(['purpose' => 'Alpha mission unique'])
            ->assertJsonMissing(['purpose' => 'Beta other trip']);
    }

    public function test_edit_wizard_parity_updates_funding_budget_and_itineraries(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $create = $http->postJson('/api/v1/travel/requests', [
            'purpose' => 'Wizard draft',
            'departure_date' => now()->addDays(12)->toDateString(),
            'return_date' => now()->addDays(15)->toDateString(),
            'destination_country' => 'Botswana',
            'destination_city' => 'Gaborone',
            'currency' => 'NAD',
            'itineraries' => [
                [
                    'from_location' => 'Windhoek',
                    'to_location' => 'Gaborone',
                    'travel_date' => now()->addDays(12)->toDateString(),
                    'transport_mode' => 'flight',
                    'days_count' => 3,
                ],
            ],
        ])->assertCreated();

        $id = $create->json('data.id');

        $http->putJson("/api/v1/travel/requests/{$id}", [
            'purpose' => 'Wizard draft revised',
            'departure_date' => now()->addDays(12)->toDateString(),
            'return_date' => now()->addDays(16)->toDateString(),
            'destination_country' => 'Botswana',
            'destination_city' => 'Gaborone',
            'currency' => 'NAD',
            'justification' => 'Mission extended by host',
            'budget_line_id' => null,
            'funding_details' => [
                [
                    'item' => 'DSA',
                    'forum_amount' => 500,
                    'host_amount' => 100,
                    'payor_sadc_pf' => true,
                    'payor_host' => true,
                    'payor_donor' => false,
                    'payor_self' => false,
                    'funding_agency' => 'SADC PF',
                    'project' => 'Core',
                    'budget_line' => 'TRAVEL-DSA',
                ],
            ],
            'itineraries' => [
                [
                    'from_location' => 'Windhoek, Namibia',
                    'to_location' => 'Gaborone, Botswana',
                    'travel_date' => now()->addDays(12)->toDateString(),
                    'transport_mode' => 'road',
                    'days_count' => 4,
                ],
                [
                    'from_location' => 'Gaborone, Botswana',
                    'to_location' => 'Windhoek, Namibia',
                    'travel_date' => now()->addDays(16)->toDateString(),
                    'transport_mode' => 'road',
                    'days_count' => 1,
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.purpose', 'Wizard draft revised')
            ->assertJsonPath('data.justification', 'Mission extended by host');

        $travel = TravelRequest::with(['itineraries', 'fundingLines'])->findOrFail($id);
        $this->assertCount(2, $travel->itineraries);
        $this->assertSame('road', $travel->itineraries->first()->transport_mode);
        $this->assertCount(1, $travel->fundingLines);
        $this->assertSame('DSA', $travel->fundingLines->first()->item);
        $this->assertEquals(500, (float) $travel->fundingLines->first()->forum_amount);

        $upload = $http->post("/api/v1/travel/requests/{$id}/attachments", [
            'file' => $this->fakePdf('invitation.pdf'),
            'document_type' => 'invitation',
        ]);
        $upload->assertCreated();
    }
}
