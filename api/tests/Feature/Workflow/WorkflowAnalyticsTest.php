<?php

namespace Tests\Feature\Workflow;

use App\Models\Tenant;
use App\Modules\WorkflowEngine\Services\WorkflowAnalyticsService;
use Tests\TestCase;

class WorkflowAnalyticsTest extends TestCase
{
    public function test_system_admin_can_load_workflow_analytics(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);

        $this->asUser($admin)
            ->getJson('/api/v1/workflow-engine/analytics')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'window_since',
                    'completed_count',
                    'avg_cycle_hours',
                    'median_cycle_hours',
                    'stage_cycle_times',
                    'bottlenecks',
                    'overdue_rate',
                    'return_rate',
                    'reject_rate',
                ],
            ]);
    }

    public function test_summary_returns_arrays_for_stage_metrics(): void
    {
        $tenant = Tenant::factory()->create();
        $summary = app(WorkflowAnalyticsService::class)->summary($tenant->id, []);

        $this->assertIsArray($summary['stage_cycle_times']);
        $this->assertIsArray($summary['bottlenecks']);
        $this->assertArrayHasKey('completed_count', $summary);
    }
}
