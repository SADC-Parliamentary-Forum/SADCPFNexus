<?php

namespace Tests\Feature\Programmes;

use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProgrammeSectionsTest extends TestCase
{
    public function test_programmes_table_has_new_section_columns(): void
    {
        $expected = [
            // Venue
            'venue_country', 'venue_city', 'venue_proposed_hotel',
            'venue_accommodation_required', 'venue_accommodation_count',
            'venue_conferencing_required', 'venue_conferencing_participants',
            'venue_quotation_attached', 'venue_hotel_quotation_attached',
            'venue_accessibility_requirements', 'venue_security_considerations', 'venue_comments',
            // Budget / participant provisions
            'proposed_dsa_rate', 'original_budget_rate', 'dsa_variance_reason',
            'proposed_participants', 'budgeted_participants', 'participants_variance_reason',
            'proposed_funding_difference', 'estimated_activity_amount',
            'budget_availability_status', 'finance_comments',
            // Consultants
            'secretariat_staff_required', 'secretariat_staff_count',
            'consultants_required', 'consultants_count', 'consultants_rate',
            'resource_persons_required', 'resource_persons_count', 'resource_persons_rate',
            'rapporteurs_required', 'rapporteurs_count', 'rapporteurs_rate',
            'media_liaison_required', 'media_liaison_count',
            'local_support_required', 'local_support_count', 'local_support_rate',
            'personnel_comments',
            // Interpretation
            'interpretation_required',
            'en_fr_required', 'en_fr_interpreters_count',
            'en_pt_required', 'en_pt_interpreters_count',
            'fr_pt_required', 'fr_pt_interpreters_count',
            'interpreter_rate', 'interpreter_source', 'interpreter_source_other_note',
            'interpretation_equipment_required', 'translation_required',
            'languages_required', 'interpretation_comments',
            // Support services
            'support_services', 'support_services_other_note',
            // Conflict of interest
            'conflict_declared', 'conflict_details', 'conflict_mitigation',
            'conflict_declared_by', 'conflict_declared_at',
            // Declaration
            'declaration_confirmed', 'declaration_confirmed_by',
            'declaration_confirmed_at', 'declaration_version',
            // Amendment tracking
            'amended_from_id', 'superseded_at',
        ];

        foreach ($expected as $column) {
            $this->assertTrue(
                Schema::hasColumn('programmes', $column),
                "programmes table is missing column: {$column}"
            );
        }
    }

    public function test_programme_mass_assigns_and_casts_new_section_fields(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $programme = \App\Models\Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Venue Test',
            'status'           => 'draft',
            'venue_country'                    => 'Namibia',
            'venue_accommodation_required'     => true,
            'venue_accommodation_count'        => 12,
            'support_services'                 => ['ground_transport', 'catering'],
            'languages_required'               => ['English', 'French'],
            'conflict_declared'                => false,
            'declaration_confirmed'            => false,
        ]);

        $this->assertTrue($programme->venue_accommodation_required);
        $this->assertSame(12, $programme->venue_accommodation_count);
        $this->assertIsArray($programme->support_services);
        $this->assertSame(['ground_transport', 'catering'], $programme->support_services);
        $this->assertIsArray($programme->languages_required);
    }
}
