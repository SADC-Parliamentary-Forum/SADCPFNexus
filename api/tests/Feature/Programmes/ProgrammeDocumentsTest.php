<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\ProgrammeDocument;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeDocumentsTest extends TestCase
{
    private function draftProgramme(Tenant $tenant, int $userId): Programme
    {
        return Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $userId,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Doc Test Programme',
            'status'           => 'draft',
        ]);
    }

    public function test_staff_can_add_a_document_row_to_a_draft_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $response = $http->postJson("/api/v1/programmes/{$programme->id}/documents", [
            'title'               => 'Concept Note',
            'document_type'       => 'concept_note',
            'translation_required'=> true,
            'target_languages'    => ['French'],
            'owner_name'          => 'Jane Partner',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('programme_documents', [
            'programme_id' => $programme->id,
            'title'        => 'Concept Note',
        ]);
    }

    public function test_document_requires_owner_user_or_owner_name(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/documents", [
            'title'         => 'No Owner Doc',
            'document_type' => 'agenda',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['owner_name']);
    }

    public function test_translation_required_document_requires_target_languages(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);

        $http->postJson("/api/v1/programmes/{$programme->id}/documents", [
            'title'                => 'Needs Translation',
            'document_type'        => 'agenda',
            'owner_name'           => 'Jane Partner',
            'translation_required' => true,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['target_languages']);
    }

    public function test_staff_can_update_and_delete_a_document_row(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $doc = ProgrammeDocument::create([
            'programme_id' => $programme->id,
            'title'        => 'Old Title',
            'document_type'=> 'agenda',
            'owner_name'   => 'Jane Partner',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}/documents/{$doc->id}", [
            'title' => 'New Title',
        ])->assertOk();
        $this->assertDatabaseHas('programme_documents', ['id' => $doc->id, 'title' => 'New Title']);

        $http->deleteJson("/api/v1/programmes/{$programme->id}/documents/{$doc->id}")->assertOk();
        $this->assertSoftDeleted('programme_documents', ['id' => $doc->id]);
    }

    public function test_clearing_owner_user_id_is_allowed_when_owner_name_already_exists(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $doc = ProgrammeDocument::create([
            'programme_id' => $programme->id,
            'title'        => 'Old Title',
            'document_type'=> 'agenda',
            'owner_name'   => 'Jane Partner',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}/documents/{$doc->id}", [
            'owner_user_id' => null,
        ])->assertOk();

        $this->assertDatabaseHas('programme_documents', [
            'id'            => $doc->id,
            'owner_user_id' => null,
            'owner_name'    => 'Jane Partner',
        ]);
    }

    public function test_clearing_owner_name_with_no_owner_user_id_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->draftProgramme($tenant, $user->id);
        $doc = ProgrammeDocument::create([
            'programme_id' => $programme->id,
            'title'        => 'Old Title',
            'document_type'=> 'agenda',
            'owner_name'   => 'Jane Partner',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}/documents/{$doc->id}", [
            'owner_name' => null,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['owner_name']);
    }
}
