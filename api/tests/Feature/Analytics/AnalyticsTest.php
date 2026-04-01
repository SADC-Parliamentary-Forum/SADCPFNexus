<?php

namespace Tests\Feature\Analytics;

use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    public function test_unauthenticated_cannot_access_analytics(): void
    {
        $this->getJson('/api/v1/analytics/summary')->assertUnauthorized();
    }

    public function test_authenticated_user_can_get_analytics_summary(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/analytics/summary');

        $response->assertOk()
                 ->assertJsonStructure([
                     'kpi' => [
                         'total_submissions',
                         'approval_rate_pct',
                         'active_travel',
                     ],
                     'by_module',
                     'monthly_submissions',
                     'activity_heatmap',
                     'recent_activity',
                 ]);
    }

    public function test_analytics_summary_kpis_are_non_negative(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/analytics/summary');
        $kpi = $response->json('kpi');

        $this->assertGreaterThanOrEqual(0, $kpi['total_submissions']);
        $this->assertGreaterThanOrEqual(0, $kpi['approval_rate_pct']);
        $this->assertGreaterThanOrEqual(0, $kpi['active_travel']);
    }

    public function test_reports_summary_returns_module_counts(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/reports/summary');

        $response->assertOk()
                 ->assertJsonStructure([
                     'travel_requests_count',
                     'leave_requests_count',
                     'report_types',
                 ]);
    }

    public function test_travel_report_supports_date_filter(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/reports/travel?period_from=2026-01-01&period_to=2026-12-31')
             ->assertOk();
    }

    public function test_leave_report_supports_date_filter(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/reports/leave?period_from=2026-01-01&period_to=2026-03-31')
             ->assertOk();
    }

    public function test_audit_logs_accessible_to_admin(): void
    {
        [$http] = $this->asAdmin();

        $http->getJson('/api/v1/admin/audit-logs')
             ->assertOk()
             ->assertJsonStructure(['data', 'total']);
    }

    public function test_audit_logs_support_date_filter(): void
    {
        [$http] = $this->asAdmin();

        $http->getJson('/api/v1/admin/audit-logs?date_from=2026-01-01&date_to=2026-12-31')
             ->assertOk();
    }

    public function test_audit_logs_inaccessible_to_staff(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/admin/audit-logs')->assertForbidden();
    }

    public function test_analytics_module_drilldown_returns_data(): void
    {
        [$http] = $this->asStaff();

        foreach (['travel', 'leave', 'imprest', 'procurement'] as $module) {
            $http->getJson("/api/v1/analytics/module/{$module}")
                 ->assertOk()
                 ->assertJsonStructure([
                     'module',
                     'total',
                     'monthly',
                     'status_dist',
                     'top_requesters',
                 ]);
        }
    }

    public function test_analytics_module_drilldown_rejects_unknown_module(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/analytics/module/unknown')->assertUnprocessable();
    }

    public function test_analytics_module_drilldown_supports_period_filter(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/analytics/module/travel?period_from=2026-01-01&period_to=2026-12-31')
             ->assertOk();
    }

    public function test_reports_travel_supports_csv_export(): void
    {
        [$http] = $this->asStaff();

        $response = $http->get('/api/v1/reports/travel?format=csv');

        $response->assertOk()
                 ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_reports_leave_supports_csv_export(): void
    {
        [$http] = $this->asStaff();

        $http->get('/api/v1/reports/leave?format=csv')
             ->assertOk()
             ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_reports_assets_supports_csv_export(): void
    {
        [$http] = $this->asStaff();

        $http->get('/api/v1/reports/assets?format=csv')
             ->assertOk()
             ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }
}
