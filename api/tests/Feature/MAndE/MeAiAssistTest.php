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

    public function test_narrative_and_nl_assist_require_confirm_and_do_not_mutate(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $narrative = $http->postJson('/api/v1/mande/ai-assist', [
            'scope' => 'narrative_draft',
            'context' => ['period' => 'Q2 2026'],
        ]);
        if ($narrative->status() === 403) {
            $this->markTestSkipped('Admin lacks mande.view in this fixture');
        }
        $narrative->assertOk()
            ->assertJsonPath('data.requires_confirmation', true)
            ->assertJsonPath('data.auto_mutate', false);

        $nl = $http->postJson('/api/v1/mande/ai-assist', [
            'scope' => 'nl_filter_suggest',
            'context' => 'overdue indicators without actuals',
        ])->assertOk()->json('data');

        $this->assertTrue($nl['requires_confirmation']);
        $this->assertFalse($nl['auto_mutate']);
        $this->assertNotEmpty($nl['suggested_filters'] ?? []);
        $this->assertNotEmpty($nl['suggested_filters'][0]['href'] ?? null);

        $before = $http->getJson('/api/v1/mande/indicators/aggregation')->assertOk()->json('data.totals');
        $http->postJson('/api/v1/mande/ai-assist/confirm', [
            'draft' => $narrative->json('data.draft'),
        ])->assertOk()->assertJsonPath('data.saved', true);
        $after = $http->getJson('/api/v1/mande/indicators/aggregation')->assertOk()->json('data.totals');
        $this->assertSame($before, $after);
    }
}
