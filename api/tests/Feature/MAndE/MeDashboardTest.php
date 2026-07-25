<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class MeDashboardTest extends TestCase
{
    public function test_dashboard_summary_succeeds_with_review_queue_join(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $programme = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Approved Programme',
            'status'           => 'approved',
            'approved_at'      => now(),
        ]);

        MeActivityReport::create([
            'tenant_id'        => $tenant->id,
            'programme_id'     => $programme->id,
            'created_by'       => $user->id,
            'reference_number' => 'AR-' . uniqid(),
            'activity_title'   => 'Submitted workshop',
            'review_status'    => 'submitted',
            'submitted_at'     => now(),
            'start_date'       => now()->subDays(10)->toDateString(),
            'end_date'         => now()->subDays(5)->toDateString(),
        ]);

        $http->getJson('/api/v1/mande/dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'kpis' => [
                        'total_reports',
                        'submitted',
                        'pending_review',
                        'awaiting_report',
                    ],
                    'by_strategic_goal',
                    'by_thematic_area',
                    'review_queue',
                ],
            ])
            ->assertJsonPath('data.kpis.submitted', 1)
            ->assertJsonPath('data.review_queue.0.activity_title', 'Submitted workshop')
            ->assertJsonPath('data.review_queue.0.pif_number', $programme->reference_number);
    }
}
