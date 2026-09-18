<?php

namespace Tests\Feature\Contracts;

use App\Models\Tenant;
use App\Modules\Contracts\Services\ContractExtractionService;
use Tests\TestCase;

/**
 * P2 — AI-assisted legacy contract extraction (PRD §103/§129). Proposes
 * unverified metadata for human confirmation; never persists.
 */
class ContractExtractionTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function sampleInterpreterAgreement(): string
    {
        return <<<'TXT'
        INTERPRETER AGREEMENT

        This agreement is made between the SADC Parliamentary Forum and
        Contractor: Jean-Pierre Bwebwe for virtual interpretation services
        (English/French) at the Legal Drafters Meeting.

        Duration: 7 September 2026 to 8 September 2026.
        Remuneration: US$ 450 per day.
        Signed on 5 September 2026.
        TXT;
    }

    public function test_service_proposes_unverified_metadata(): void
    {
        $result = app(ContractExtractionService::class)->extract($this->sampleInterpreterAgreement());

        $this->assertTrue($result['unverified']);
        $this->assertSame('Jean-Pierre Bwebwe', $result['suggestions']['counterparty_name']['value']);
        $this->assertSame('USD', $result['suggestions']['currency']['value']);
        $this->assertSame(450.0, $result['suggestions']['value']['value']);
        $this->assertSame('Interpreter Agreement', $result['suggestions']['type_hint']['value']);
        $this->assertSame('2026-09-07', $result['suggestions']['start_date']['value']);
        $this->assertSame('2026-09-08', $result['suggestions']['end_date']['value']);
        $this->assertSame('2026-09-05', $result['suggestions']['signed_at']['value']);
    }

    public function test_extract_endpoint_returns_suggestions(): void
    {
        [$po] = $this->asProcurementOfficer($this->tenant);

        $res = $po->postJson('/api/v1/contracts/extract', ['text' => $this->sampleInterpreterAgreement()])->assertOk();
        $res->assertJsonPath('data.unverified', true)
            ->assertJsonPath('data.suggestions.counterparty_name.value', 'Jean-Pierre Bwebwe')
            ->assertJsonPath('data.suggestions.value.value', 450);
    }

    public function test_extract_requires_input(): void
    {
        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->postJson('/api/v1/contracts/extract', ['text' => '   '])->assertStatus(422);
    }

    public function test_extract_requires_create_permission(): void
    {
        [$staff] = $this->asStaff($this->tenant);
        $staff->postJson('/api/v1/contracts/extract', ['text' => 'anything'])->assertForbidden();
    }
}
