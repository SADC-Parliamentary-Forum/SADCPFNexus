<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeDocument;
use App\Models\ProgrammeProcurementItem;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeAmendmentTest extends TestCase
{
    private function approvedProgramme(Tenant $tenant, int $userId): Programme
    {
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $userId,
            'reference_number' => 'PIF-2026-001', 'title' => 'Amendment Test',
            'status' => 'approved', 'approved_at' => now(), 'venue_country' => 'Namibia',
        ]);
        ProgrammeDocument::create(['programme_id' => $programme->id, 'title' => 'Agenda', 'document_type' => 'agenda', 'owner_name' => 'Jane']);
        return $programme;
    }

    public function test_amendment_can_only_be_created_from_an_approved_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $draft = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $user->id,
            'reference_number' => 'PIF-2026-002', 'title' => 'Draft', 'status' => 'draft',
        ]);

        $http->postJson("/api/v1/programmes/{$draft->id}/amend")->assertUnprocessable();
    }

    public function test_amendment_clones_the_original_and_its_documents(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $response = $http->postJson("/api/v1/programmes/{$original->id}/amend")->assertCreated();
        $amendmentId = $response->json('data.id');

        $this->assertDatabaseHas('programmes', [
            'id' => $amendmentId, 'status' => 'amendment_draft', 'amended_from_id' => $original->id,
            'venue_country' => 'Namibia',
        ]);
        $this->assertDatabaseHas('programme_documents', [
            'programme_id' => $amendmentId, 'title' => 'Agenda',
        ]);
    }

    public function test_only_one_open_amendment_allowed_at_a_time(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$original->id}/amend")->assertCreated();
        $http->postJson("/api/v1/programmes/{$original->id}/amend")->assertUnprocessable();
    }

    public function test_approving_an_amendment_supersedes_the_original(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $amendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');
        $http->postJson("/api/v1/programmes/{$amendmentId}/submit-amendment", ['declaration_confirmed' => true])->assertOk();

        // Switch the acting user to admin immediately before the approval request:
        // Sanctum::actingAs() is a global override, so calling asAdmin() any earlier
        // would have made the preceding $http calls act as admin too (self-approval).
        [$adminHttp] = $this->asAdmin($tenant);
        $adminHttp->postJson("/api/v1/programmes/{$amendmentId}/approve")->assertOk();

        $this->assertDatabaseHas('programmes', ['id' => $amendmentId, 'status' => 'amended']);
        $this->assertDatabaseHas('programmes', ['id' => $original->id, 'status' => 'superseded']);
    }

    public function test_diff_endpoint_shows_changed_fields(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);
        $amendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');

        $http->putJson("/api/v1/programmes/{$amendmentId}", ['venue_city' => 'Windhoek'])->assertOk();

        $response = $http->getJson("/api/v1/programmes/{$amendmentId}/diff")->assertOk();
        $this->assertArrayHasKey('venue_city', $response->json('data'));
    }

    public function test_submitting_amendment_without_declaration_confirmation_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);
        $amendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');

        $http->postJson("/api/v1/programmes/{$amendmentId}/submit-amendment")->assertUnprocessable();

        $this->assertDatabaseHas('programmes', ['id' => $amendmentId, 'status' => 'amendment_draft']);
    }

    public function test_submitting_amendment_with_declaration_confirmation_stamps_declaration_fields(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);
        $amendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');

        $http->postJson("/api/v1/programmes/{$amendmentId}/submit-amendment", ['declaration_confirmed' => true])
            ->assertOk();

        $amendment = Programme::find($amendmentId);
        $this->assertEquals('amendment_pending_approval', $amendment->status);
        $this->assertTrue((bool) $amendment->declaration_confirmed);
        $this->assertEquals($user->id, $amendment->declaration_confirmed_by);
        $this->assertNotNull($amendment->declaration_confirmed_at);
        $this->assertEquals(config('pif.current_declaration_version'), $amendment->declaration_version);
    }

    public function test_an_amended_programme_can_be_amended_again_and_chains_to_the_amended_record(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $firstAmendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');
        $http->postJson("/api/v1/programmes/{$firstAmendmentId}/submit-amendment", ['declaration_confirmed' => true])
            ->assertOk();

        [$adminHttp] = $this->asAdmin($tenant);
        $adminHttp->postJson("/api/v1/programmes/{$firstAmendmentId}/approve")->assertOk();

        $this->assertDatabaseHas('programmes', ['id' => $firstAmendmentId, 'status' => 'amended']);

        // Amend the already-amended record.
        [$http2] = $this->asProgrammeOfficer($tenant);
        $response = $http2->postJson("/api/v1/programmes/{$firstAmendmentId}/amend")->assertCreated();
        $secondAmendmentId = $response->json('data.id');

        $this->assertDatabaseHas('programmes', [
            'id' => $secondAmendmentId, 'status' => 'amendment_draft', 'amended_from_id' => $firstAmendmentId,
        ]);
    }

    public function test_send_to_procurement_works_on_an_amended_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $original = $this->approvedProgramme($tenant, $user->id);

        $amendmentId = $http->postJson("/api/v1/programmes/{$original->id}/amend")->json('data.id');
        $http->postJson("/api/v1/programmes/{$amendmentId}/submit-amendment", ['declaration_confirmed' => true])
            ->assertOk();

        [$adminHttp] = $this->asAdmin($tenant);
        $adminHttp->postJson("/api/v1/programmes/{$amendmentId}/approve")->assertOk();
        $this->assertDatabaseHas('programmes', ['id' => $amendmentId, 'status' => 'amended']);

        $item = ProgrammeProcurementItem::create([
            'programme_id' => $amendmentId, 'description' => 'Catering', 'estimated_cost' => 500,
        ]);

        $response = $http->postJson("/api/v1/programmes/{$amendmentId}/send-to-procurement", [
            'procurement_item_ids' => [$item->id],
            'request_title'        => 'Procurement for amended activity',
        ]);

        $response->assertOk();
        $requestId = $response->json('data.id');
        $this->assertDatabaseHas('programme_procurement_items', ['id' => $item->id, 'procurement_request_id' => $requestId]);
    }
}
