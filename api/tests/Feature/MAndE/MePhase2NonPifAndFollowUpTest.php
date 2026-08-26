<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\MeFollowUpAction;
use App\Models\Tenant;
use Tests\TestCase;

class MePhase2NonPifAndFollowUpTest extends TestCase
{
    public function test_staff_can_create_non_pif_report_with_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asMeOfficer($tenant);

        $http->postJson('/api/v1/mande/activity-reports', [
            'activity_title' => 'Internal technical meeting',
            'non_pif_reason' => 'No expenditure; virtual internal briefing',
        ])->assertCreated()
            ->assertJsonPath('data.activity_title', 'Internal technical meeting')
            ->assertJsonPath('data.programme_id', null);

        $this->assertDatabaseHas('me_activity_reports', [
            'tenant_id' => $tenant->id,
            'activity_title' => 'Internal technical meeting',
            'programme_id' => null,
        ]);
    }

    public function test_non_pif_requires_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asMeOfficer($tenant);

        $http->postJson('/api/v1/mande/activity-reports', [
            'activity_title' => 'Missing reason',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['non_pif_reason']);
    }

    public function test_follow_up_crud_on_activity_report(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asMeOfficer($tenant);

        $report = MeActivityReport::create([
            'tenant_id' => $tenant->id,
            'programme_id' => null,
            'non_pif_reason' => 'Internal meeting for follow-up test',
            'activity_title' => 'Follow-up host',
            'review_status' => 'not_submitted',
            'created_by' => $user->id,
            'responsible_officer_id' => $user->id,
        ]);

        $created = $http->postJson("/api/v1/mande/activity-reports/{$report->id}/follow-ups", [
            'action' => 'Circulate meeting notes',
            'due_date' => now()->addDays(7)->toDateString(),
            'priority' => 'high',
        ])->assertCreated()
            ->json('data');

        $this->assertSame('Circulate meeting notes', $created['action']);
        $this->assertSame('open', $created['status']);

        $http->putJson("/api/v1/mande/activity-reports/{$report->id}/follow-ups/{$created['id']}", [
            'status' => 'completed',
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertNotNull(MeFollowUpAction::find($created['id'])->completed_at);

        $http->getJson("/api/v1/mande/activity-reports/{$report->id}/follow-ups")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
