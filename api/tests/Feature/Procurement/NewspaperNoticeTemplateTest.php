<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Tender;
use Tests\TestCase;

class NewspaperNoticeTemplateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['access_control.endpoint_enforcement_mode' => 'off']);
    }

    private function publishedTender(Tenant $tenant, $officer): Tender
    {
        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Conference stationery',
            'description' => 'Consumables for the plenary',
            'category' => 'goods',
            'estimated_value' => 180_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'procurement_method' => 'tender',
        ]);

        return Tender::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number' => 'TND-NP-'.uniqid(),
            'title' => 'Conference stationery',
            'notice' => 'SADC PF invites sealed bids for conference stationery.',
            'status' => Tender::STATUS_PUBLISHED,
            'published_at' => now(),
            'submission_deadline' => now()->addDays(14)->toDateString(),
            'sealed_mode' => true,
            'created_by' => $officer->id,
        ]);
    }

    public function test_templates_are_checklists_and_never_auto_award(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $res = $http->getJson('/api/v1/procurement/newspaper-notice-templates')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($res['templates']);
        $this->assertFalse($res['auto_award']);
        $this->assertTrue($res['requires_human_publication']);
        $keys = collect($res['templates'])->pluck('key')->all();
        $this->assertContains('open_tender', $keys);
        $this->assertContains('rfq', $keys);
    }

    public function test_tender_notice_pack_fills_template_and_records_human_ticks(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asAdmin($tenant);
        $tender = $this->publishedTender($tenant, $officer);

        $pack = $http->getJson('/api/v1/procurement/tenders/'.$tender->id.'/newspaper-notice')
            ->assertOk()
            ->json('data');

        $this->assertSame($tender->reference_number, $pack['reference_number']);
        $this->assertStringContainsString($tender->title, $pack['filled_notice']);
        $this->assertFalse($pack['auto_award']);
        $detected = collect($pack['checklist'])->where('detected', true)->pluck('key')->all();
        $this->assertContains('notice_text_present', $detected);
        $this->assertContains('deadline_stated', $detected);

        $http->patchJson('/api/v1/procurement/tenders/'.$tender->id.'/newspaper-notice-checklist', [
            'template_key' => 'open_tender',
            'ticks' => [
                'newspaper_named' => true,
                'proof_of_publication_filed' => true,
            ],
        ])->assertOk()
            ->assertJsonPath('data.ticks.newspaper_named', true)
            ->assertJsonPath('data.auto_award', false);

        $this->assertSame(Tender::STATUS_PUBLISHED, $tender->fresh()->status);
        $this->assertNotSame(Tender::STATUS_AWARDED, $tender->fresh()->status);
    }
}
