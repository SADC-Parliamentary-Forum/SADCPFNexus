<?php

namespace Tests\Feature\Reports;

use App\Models\Tenant;
use Tests\TestCase;

class ReportManagementPhase1Test extends TestCase
{
    public function test_scheduled_report_requires_independent_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$ownerHttp, $owner] = $this->asAdmin($tenant);
        $approver = $this->makeAdmin($tenant);

        $schedule = $ownerHttp->postJson('/api/v1/reports/schedules', [
            'report_key' => 'travel',
            'label' => 'Monthly travel report',
            'format' => 'csv',
            'recipients' => ['reports@example.org'],
            'frequency' => 'monthly',
        ])->assertCreated()->json('data');

        $ownerHttp->postJson("/api/v1/reports/schedules/{$schedule['id']}/approve")
            ->assertStatus(422);

        $this->asUser($approver)
            ->postJson("/api/v1/reports/schedules/{$schedule['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.approved_by', $approver->id);
    }

    public function test_schedule_listing_is_tenant_scoped(): void
    {
        $tenant = Tenant::factory()->create();
        [$ownerHttp] = $this->asAdmin($tenant);

        $ownerHttp->postJson('/api/v1/reports/schedules', [
            'report_key' => 'leave',
            'label' => 'Leave summary',
            'format' => 'csv',
            'recipients' => ['reports@example.org'],
            'frequency' => 'weekly',
        ])->assertCreated();

        $ownerHttp->getJson('/api/v1/reports/schedules')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
