<?php

namespace Tests\Feature\Decisions;

use App\Models\Assignment;
use App\Models\MeetingAgendaItem;
use App\Models\MeetingDecision;
use App\Models\Tenant;
use App\Modules\Decisions\Services\DecisionAssignmentPromoteService;
use Tests\TestCase;

class MeetingResolutionsPhase3Test extends TestCase
{
    public function test_agenda_item_create_and_link_decision(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeGovernanceOfficer($tenant);

        $decision = MeetingDecision::create([
            'tenant_id' => $tenant->id,
            'decision_type' => 'resolution',
            'title' => 'Adopt ICT policy',
            'body' => 'Resolved that…',
            'status' => 'draft',
            'owner_id' => $user->id,
            'created_by' => $user->id,
            'due_date' => now()->addDays(14)->toDateString(),
        ]);

        $create = $this->asUser($user)->postJson('/api/v1/decisions/agenda-items', [
            'title' => 'ICT policy adoption',
            'sequence' => 2,
            'description' => 'Discuss and adopt',
        ]);
        $create->assertCreated();
        $agendaId = $create->json('data.id');

        $this->asUser($user)->postJson("/api/v1/decisions/agenda-items/{$agendaId}/link-decision", [
            'meeting_decision_id' => $decision->id,
        ])->assertOk();

        $this->assertSame($agendaId, $decision->fresh()->agenda_item_id);
        $this->assertSame($decision->id, MeetingAgendaItem::find($agendaId)->meeting_decision_id);
    }

    public function test_owner_and_minutes_pickers_available(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeGovernanceOfficer($tenant);
        $peer = $this->makeUser('staff', $tenant);

        $owners = $this->asUser($user)->getJson('/api/v1/decisions/owners')->assertOk()->json('data');
        $ids = collect($owners)->pluck('id')->all();
        $this->assertContains($user->id, $ids);
        $this->assertContains($peer->id, $ids);

        $this->asUser($user)->getJson('/api/v1/decisions/minutes-options')->assertOk();
    }

    public function test_weekly_auto_promote_is_idempotent(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $adopter = $this->makeGovernanceOfficer($tenant);

        $decision = MeetingDecision::create([
            'tenant_id' => $tenant->id,
            'decision_type' => 'resolution',
            'title' => 'Promote me',
            'body' => 'Body',
            'status' => 'adopted',
            'owner_id' => $owner->id,
            'created_by' => $adopter->id,
            'adopted_by' => $adopter->id,
            'adopted_at' => now(),
            'due_date' => now()->addDays(10)->toDateString(),
        ]);

        $service = app(DecisionAssignmentPromoteService::class);
        $first = $service->promoteTenant($tenant->id);
        $second = $service->promoteTenant($tenant->id);

        $this->assertSame(1, $first['promoted']);
        $this->assertSame(0, $second['promoted']);
        $this->assertSame(1, Assignment::where('tenant_id', $tenant->id)
            ->where('source_type', 'meeting_decision')
            ->where('source_id', $decision->id)
            ->where('source_purpose', 'weekly_promote')
            ->count());
        $this->assertNotNull($decision->fresh()->last_promoted_at);
    }
}
