<?php

namespace Tests\Feature\Decisions;

use App\Models\MeetingDecision;
use App\Models\Risk;
use App\Models\Tenant;
use Tests\TestCase;

class DecisionRiskPromoteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['access_control.endpoint_enforcement_mode' => 'off']);
    }

    public function test_promote_risks_creates_draft_risks_and_never_closes_the_decision(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);

        $decision = MeetingDecision::create([
            'tenant_id' => $tenant->id,
            'created_by' => $admin->id,
            'owner_id' => $admin->id,
            'title' => 'Emerging risk: venue capacity overflow',
            'body' => 'Plenary hall may exceed fire-safety capacity.',
            'status' => 'adopted',
            'due_date' => now()->addWeek()->toDateString(),
            'decision_type' => 'management_decision',
        ]);

        $first = $http->postJson('/api/v1/decisions/promote-risks')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(1, $first['promoted']);
        $this->assertSame('adopted', $decision->fresh()->status);

        $risk = Risk::query()
            ->where('tenant_id', $tenant->id)
            ->where('source_type', 'meeting_decision')
            ->where('source_id', $decision->id)
            ->first();
        $this->assertNotNull($risk);
        $this->assertContains($risk->status, ['draft', 'proposed']);
        $this->assertNotSame('closed', $risk->status);

        $second = $http->postJson('/api/v1/decisions/promote-risks')->assertOk()->json('data');
        $this->assertSame(0, $second['promoted']);
        $this->assertSame(1, Risk::where('tenant_id', $tenant->id)->where('source_purpose', 'meeting_risk_promote')->count());
    }

    public function test_meeting_pack_promotes_assignments_and_risks_without_closing(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);

        $decision = MeetingDecision::create([
            'tenant_id' => $tenant->id,
            'created_by' => $admin->id,
            'owner_id' => $admin->id,
            'title' => 'Risk of delayed plenary pack',
            'body' => 'Owner to issue the briefing pack.',
            'status' => 'adopted',
            'due_date' => now()->addWeek()->toDateString(),
            'decision_type' => 'management_decision',
        ]);

        $pack = $http->postJson('/api/v1/decisions/promote-meeting-pack')
            ->assertOk()
            ->json('data');

        $this->assertFalse($pack['auto_complete']);
        $this->assertFalse($pack['auto_close_decisions']);
        $this->assertArrayHasKey('assignments', $pack);
        $this->assertArrayHasKey('risks', $pack);
        $this->assertNotSame('closed', $decision->fresh()->status);
        $this->assertNotSame('cancelled', $decision->fresh()->status);
    }

    public function test_promote_from_minutes_scopes_and_never_closes(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);

        $minutes = \App\Models\MeetingMinutes::create([
            'tenant_id' => $tenant->id,
            'created_by' => $admin->id,
            'title' => 'Plenary risk session',
            'meeting_date' => now()->toDateString(),
            'meeting_type' => 'management',
            'status' => 'draft',
            'chairperson' => $admin->name,
        ]);

        $decision = MeetingDecision::create([
            'tenant_id' => $tenant->id,
            'created_by' => $admin->id,
            'owner_id' => $admin->id,
            'title' => 'Risk of delayed plenary pack',
            'body' => 'Owner to issue the briefing pack.',
            'status' => 'adopted',
            'due_date' => now()->addWeek()->toDateString(),
            'decision_type' => 'management_decision',
            'meeting_minutes_id' => $minutes->id,
        ]);

        $other = MeetingDecision::create([
            'tenant_id' => $tenant->id,
            'created_by' => $admin->id,
            'owner_id' => $admin->id,
            'title' => 'Risk of unrelated venue overflow',
            'body' => 'Other meeting.',
            'status' => 'adopted',
            'due_date' => now()->addWeek()->toDateString(),
            'decision_type' => 'management_decision',
        ]);

        $pack = $http->postJson('/api/v1/decisions/promote-from-minutes', [
            'meeting_minutes_id' => $minutes->id,
        ])->assertOk()->json('data');

        $this->assertSame($minutes->id, $pack['meeting_minutes_id']);
        $this->assertFalse($pack['auto_close_decisions']);
        $this->assertSame('adopted', $decision->fresh()->status);
        $this->assertSame('adopted', $other->fresh()->status);
        $this->assertSame(1, Risk::where('tenant_id', $tenant->id)->where('source_id', $decision->id)->count());
        $this->assertSame(0, Risk::where('tenant_id', $tenant->id)->where('source_id', $other->id)->count());
    }
}
