<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammeDeclarationTest extends TestCase
{
    public function test_submit_fails_without_declaration_confirmation(): void
    {
        [$http] = $this->asStaff();
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Declaration Test'])->json('data.id');

        $http->postJson("/api/v1/programmes/{$programmeId}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['declaration_confirmed']);
    }

    public function test_submit_succeeds_and_stamps_declaration_when_confirmed(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programmeId = $http->postJson('/api/v1/programmes', ['title' => 'Declaration Test'])->json('data.id');

        $http->postJson("/api/v1/programmes/{$programmeId}/submit", [
            'declaration_confirmed' => true,
        ])->assertOk();

        $programme = Programme::find($programmeId);
        $this->assertTrue($programme->declaration_confirmed);
        $this->assertSame($user->id, $programme->declaration_confirmed_by);
        $this->assertNotNull($programme->declaration_confirmed_at);
        $this->assertNotNull($programme->declaration_version);
    }
}
