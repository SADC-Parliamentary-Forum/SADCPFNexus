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
            'media_liaison_required', 'media_liaison_count', 'media_liaison_rate',
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

    public function test_reaffirming_already_declared_conflict_without_resending_details_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Reaffirm Test'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared'   => true,
            'conflict_details'    => 'Spouse works at the proposed vendor',
            'conflict_mitigation' => 'Recused from vendor selection',
        ])->assertOk();

        // Re-affirming conflict_declared=true alone, without resending the
        // text fields, must succeed — the DB already has non-empty details
        // and mitigation to fall back on.
        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                   => $programmeId,
            'conflict_details'     => 'Spouse works at the proposed vendor',
            'conflict_mitigation'  => 'Recused from vendor selection',
        ]);
    }

    public function test_fresh_conflict_declaration_without_details_anywhere_still_fails(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Conflict Fresh Test'])->json('data.id');

        // No prior conflict declared, no details in DB or request — must
        // still 422 since there is genuinely nothing to fall back to.
        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'conflict_declared' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['conflict_details', 'conflict_mitigation']);
    }

    // -------------------------------------------------------------------
    // Symmetric fix: reaffirmation-without-resending regression coverage
    // for the remaining 10 conditional validation fields.
    // -------------------------------------------------------------------

    public function test_reaffirming_venue_accommodation_required_without_resending_count_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Venue Accom Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_accommodation_required' => true,
            'venue_accommodation_count'    => 5,
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_accommodation_required' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                         => $programmeId,
            'venue_accommodation_count'  => 5,
        ]);
    }

    public function test_reaffirming_venue_conferencing_required_without_resending_participants_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Venue Conf Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_conferencing_required'     => true,
            'venue_conferencing_participants' => 20,
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_conferencing_required' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                                => $programmeId,
            'venue_conferencing_participants'    => 20,
        ]);
    }

    public function test_fresh_venue_conferencing_required_without_participants_anywhere_still_fails(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Venue Conf Fresh'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'venue_conferencing_required' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['venue_conferencing_participants']);
    }

    public function test_reaffirming_en_fr_required_without_resending_interpreters_count_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'EN-FR Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'en_fr_required'           => true,
            'en_fr_interpreters_count' => 2,
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'en_fr_required' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                          => $programmeId,
            'en_fr_interpreters_count'    => 2,
        ]);
    }

    public function test_fresh_en_fr_required_without_interpreters_count_anywhere_still_fails(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'EN-FR Fresh'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'en_fr_required' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['en_fr_interpreters_count']);
    }

    public function test_reaffirming_en_pt_required_without_resending_interpreters_count_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'EN-PT Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'en_pt_required'           => true,
            'en_pt_interpreters_count' => 3,
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'en_pt_required' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                          => $programmeId,
            'en_pt_interpreters_count'    => 3,
        ]);
    }

    public function test_reaffirming_fr_pt_required_without_resending_interpreters_count_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'FR-PT Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'fr_pt_required'           => true,
            'fr_pt_interpreters_count' => 1,
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'fr_pt_required' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                          => $programmeId,
            'fr_pt_interpreters_count'    => 1,
        ]);
    }

    public function test_reaffirming_interpreter_source_other_without_resending_note_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Interpreter Source Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'interpreter_source'            => 'other',
            'interpreter_source_other_note' => 'Community volunteer interpreters',
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'interpreter_source' => 'other',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                               => $programmeId,
            'interpreter_source_other_note'    => 'Community volunteer interpreters',
        ]);
    }

    public function test_reaffirming_translation_required_without_resending_languages_required_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Translation Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'translation_required' => true,
            'languages_required'   => ['English', 'French'],
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'translation_required' => true,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id' => $programmeId,
        ]);
        $programme = \App\Models\Programme::find($programmeId);
        $this->assertSame(['English', 'French'], $programme->languages_required);
    }

    public function test_reaffirming_support_services_other_without_resending_note_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Support Services Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'support_services'            => ['ground_transport', 'other'],
            'support_services_other_note' => 'Boat transfer for delegates',
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'support_services' => ['ground_transport', 'other'],
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                            => $programmeId,
            'support_services_other_note'   => 'Boat transfer for delegates',
        ]);
    }

    public function test_reaffirming_dsa_rates_without_resending_variance_reason_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'DSA Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_dsa_rate'    => 250,
            'original_budget_rate' => 200,
            'dsa_variance_reason'  => 'Venue city has higher accommodation costs',
        ])->assertOk();

        // Re-send the same rates alone (e.g. a follow-up PUT re-affirming the
        // section) without resending the reason — must succeed via DB fallback.
        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_dsa_rate'    => 250,
            'original_budget_rate' => 200,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                    => $programmeId,
            'dsa_variance_reason'   => 'Venue city has higher accommodation costs',
        ]);
    }

    public function test_reaffirming_participants_variance_without_resending_reason_succeeds(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Participants Reaffirm'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_participants'          => 40,
            'budgeted_participants'          => 30,
            'participants_variance_reason'   => 'Additional member state delegates confirmed late',
        ])->assertOk();

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_participants' => 40,
            'budgeted_participants' => 30,
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'                              => $programmeId,
            'participants_variance_reason'    => 'Additional member state delegates confirmed late',
        ]);
    }

    public function test_fresh_participants_variance_without_reason_anywhere_still_fails(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Participants Fresh'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_participants' => 40,
            'budgeted_participants' => 30,
        ])->assertUnprocessable()->assertJsonValidationErrors(['participants_variance_reason']);
    }

    public function test_unrelated_update_does_not_retrigger_dsa_variance_reason_requirement(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'DSA Variance Regression'])->json('data.id');

        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'proposed_dsa_rate'    => 250,
            'original_budget_rate' => 200,
            'dsa_variance_reason'  => 'Venue city has higher accommodation costs',
        ])->assertOk();

        // A later, totally unrelated partial update touching neither the
        // trigger rates nor the reason must not re-trigger the requirement.
        $http->putJson("/api/v1/programmes/{$programmeId}", [
            'title' => 'DSA Variance Regression Renamed',
        ])->assertOk();
    }
}
