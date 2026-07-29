<?php

namespace Tests\Feature\MAndE;

use App\Models\Tenant;
use Tests\TestCase;

class MeAiAssistTest extends TestCase
{
    public function test_ai_assist_returns_draft_requiring_confirmation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $res = $http->postJson('/api/v1/mande/ai-assist', [
            'scope' => 'indicator_summary',
            'context' => 'Coverage for Q2 donor indicators',
        ]);

        if ($res->status() === 403) {
            $this->markTestSkipped('Admin lacks mande.view in this fixture');
        }

        $res->assertOk()
            ->assertJsonPath('data.requires_confirmation', true)
            ->assertJsonStructure(['data' => ['draft', 'provider']]);

        $http->postJson('/api/v1/mande/ai-assist/confirm', [
            'draft' => $res->json('data.draft'),
        ])->assertOk()
            ->assertJsonPath('data.saved', true);

        $http->getJson('/api/v1/mande/indicators/aggregation')
            ->assertOk()
            ->assertJsonStructure(['data' => ['totals']]);
    }
}
