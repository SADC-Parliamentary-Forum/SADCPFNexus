<?php

namespace Tests\Feature\WeeklyReports;

use App\Models\Tenant;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportingPeriod;
use App\Modules\WeeklyReports\Services\WeeklyAiDraftService;
use Tests\TestCase;

class WeeklyComplianceDigestTest extends TestCase
{
    public function test_compliance_digest_command_reports_missing_summaries(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $missingUser = $this->makeUser('staff', $tenant);

        $period = WeeklyReportingPeriod::create([
            'tenant_id' => $tenant->id,
            'reference' => 'WRP-GAP-'.uniqid(),
            'start_date' => now()->startOfWeek()->toDateString(),
            'end_date' => now()->startOfWeek()->addDays(4)->toDateString(),
            'status' => 'open',
        ]);

        WeeklyReport::create([
            'tenant_id' => $tenant->id,
            'period_id' => $period->id,
            'employee_id' => $admin->id,
            'owner_id' => $admin->id,
            'reference' => 'WR-'.uniqid(),
            'report_type' => WeeklyReport::TYPE_INDIVIDUAL,
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        $this->assertDatabaseMissing('weekly_reports', [
            'period_id' => $period->id,
            'employee_id' => $missingUser->id,
        ]);

        $this->artisan('weekly-reports:send-compliance-digest', [
            '--period' => $period->id,
            '--tenant' => $tenant->id,
            '--dry-run' => true,
        ])->assertSuccessful();
    }

    public function test_ai_draft_provider_hook_defaults_to_stub_and_requires_confirm(): void
    {
        config(['weekly_reports.ai_provider' => 'stub']);

        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $period = WeeklyReportingPeriod::create([
            'tenant_id' => $tenant->id,
            'reference' => 'WRP-AI-'.uniqid(),
            'start_date' => now()->startOfWeek()->toDateString(),
            'end_date' => now()->startOfWeek()->addDays(4)->toDateString(),
            'status' => 'open',
        ]);

        $report = WeeklyReport::create([
            'tenant_id' => $tenant->id,
            'period_id' => $period->id,
            'employee_id' => $user->id,
            'owner_id' => $user->id,
            'reference' => 'WR-'.uniqid(),
            'report_type' => WeeklyReport::TYPE_INDIVIDUAL,
            'status' => 'draft',
        ]);

        $result = app(WeeklyAiDraftService::class)->generateDraft($report, $user, [
            'suggestions' => [
                ['title' => 'Closed ticket', 'decision' => 'included', 'suggested_section' => 'achievement'],
            ],
        ]);

        $this->assertTrue($result['requires_human_confirm']);
        $this->assertFalse($result['auto_submit']);
        $this->assertSame('stub', $result['provider'] ?? config('weekly_reports.ai_provider', 'stub'));
        $this->assertStringContainsString('human confirmation', strtolower($result['draft']));
        $this->assertNull($report->fresh()->ai_draft_confirmed_at);
    }
}
