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

    public function test_venue_accommodation_count_required_when_accommodation_required(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Venue Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_accommodation_required' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['venue_accommodation_count']);
    }

    public function test_support_services_other_requires_note_even_as_array(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Support Services Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'support_services' => ['ground_transport', 'other'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['support_services_other_note']);

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'support_services'            => ['ground_transport', 'other'],
            'support_services_other_note' => 'Boat transfer for delegates',
        ])->assertOk();
    }

    public function test_dsa_variance_reason_required_when_rates_differ(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'DSA Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_dsa_rate'    => 250,
            'original_budget_rate' => 200,
        ])->assertUnprocessable()->assertJsonValidationErrors(['dsa_variance_reason']);

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_dsa_rate'    => 250,
            'original_budget_rate' => 200,
            'dsa_variance_reason'  => 'Venue city has higher accommodation costs',
        ])->assertOk();
    }

    public function test_conflict_mitigation_required_when_conflict_declared(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared' => true,
            'conflict_details'  => 'Spouse works at the proposed vendor',
        ])->assertUnprocessable()->assertJsonValidationErrors(['conflict_mitigation']);
    }

    public function test_conflict_declared_by_and_at_are_set_server_side_not_from_payload(): void
    {
        $tenant = \App\Models\Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $other = $this->makeUser('staff', $tenant);
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Stamp Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared'    => true,
            'conflict_details'     => 'Details',
            'conflict_mitigation'  => 'Mitigation',
            'conflict_declared_by' => $other->id, // must be ignored
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                    => $programmeId,
            'conflict_declared_by'  => $user->id,
        ]);
    }

    public function test_unrelated_update_does_not_retrigger_venue_accommodation_requirement(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Venue Regression Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_accommodation_required' => true,
            'venue_accommodation_count'    => 5,
        ])->assertOk();

        // A later, totally unrelated partial update must not re-trigger the
        // venue_accommodation_count requirement just because the DB flag is true.
        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'title' => 'Renamed',
        ])->assertOk();
    }

    public function test_unrelated_update_does_not_retrigger_conflict_requirements(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Regression Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared'   => true,
            'conflict_details'    => 'Spouse works at the proposed vendor',
            'conflict_mitigation' => 'Recused from vendor selection',
        ])->assertOk();

        // A later, totally unrelated partial update must not re-trigger the
        // conflict_details/conflict_mitigation requirement just because the
        // DB flag is true.
        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'title' => 'Renamed Conflict Test',
        ])->assertOk();
    }

    public function test_conflict_details_can_be_amended_without_resending_conflict_declared(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Amend Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared'   => true,
            'conflict_details'    => 'Spouse works at the proposed vendor',
            'conflict_mitigation' => 'Recused from vendor selection',
        ])->assertOk();

        // Amend conflict_details only, without resending conflict_declared.
        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_details' => 'corrected wording',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                => $programmeId,
            'conflict_details'  => 'corrected wording',
        ]);
    }
}
