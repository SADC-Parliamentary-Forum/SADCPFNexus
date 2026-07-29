<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportingPeriod;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class WeeklyReportsSendComplianceDigest extends Command
{
    protected $signature = 'weekly-reports:send-compliance-digest
        {--period= : Weekly reporting period id}
        {--tenant= : Limit to one tenant id}
        {--dry-run : List missing reports without sending notifications}';

    protected $description = 'Send weekly compliance digests for missing individual weekly summaries (human follow-up; never auto-submits).';

    public function handle(NotificationService $notifications): int
    {
        $periodId = $this->option('period');
        $tenantId = $this->option('tenant');
        $dryRun = (bool) $this->option('dry-run');

        $tenants = Tenant::query()
            ->when($tenantId, fn ($q) => $q->where('id', $tenantId))
            ->get();

        $totalMissing = 0;

        foreach ($tenants as $tenant) {
            $period = $periodId
                ? WeeklyReportingPeriod::where('tenant_id', $tenant->id)->find($periodId)
                : WeeklyReportingPeriod::where('tenant_id', $tenant->id)
                    ->where('status', 'open')
                    ->orderByDesc('start_date')
                    ->first();

            if (! $period) {
                $this->line("Tenant {$tenant->id}: no open period — skipped.");
                continue;
            }

            $employees = User::query()
                ->where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->get();

            $submittedIds = WeeklyReport::query()
                ->where('tenant_id', $tenant->id)
                ->where('period_id', $period->id)
                ->where('report_type', WeeklyReport::TYPE_INDIVIDUAL)
                ->where(function ($q) {
                    $q->whereNotNull('submitted_at')
                        ->orWhereIn('status', ['submitted', 'accepted', 'published', 'exempted']);
                })
                ->pluck('employee_id')
                ->filter()
                ->all();

            $missing = $employees->reject(fn (User $u) => in_array($u->id, $submittedIds, true));
            $count = $missing->count();
            $totalMissing += $count;

            $this->info("Tenant {$tenant->id} period {$period->reference}: {$count} missing.");

            if ($dryRun || $count === 0) {
                continue;
            }

            $supervisors = User::role(['HR Manager', 'HR Administrator', 'System Admin', 'Secretary General'])
                ->where('tenant_id', $tenant->id)
                ->get();

            if ($supervisors->isEmpty()) {
                $supervisors = User::where('tenant_id', $tenant->id)
                    ->whereHas('roles', fn ($q) => $q->whereIn('name', ['System Admin', 'HR Manager']))
                    ->get();
            }

            $names = $missing->take(25)->pluck('name')->implode(', ');
            $notifications->dispatchToMany($supervisors, 'weekly_reports.compliance_digest', [
                'period' => $period->reference,
                'missing_count' => $count,
                'missing_sample' => $names,
            ], [
                'module' => 'weekly-summaries',
                'url' => '/weekly-summaries/compliance',
            ]);
        }

        $this->line("Compliance digest complete — {$totalMissing} missing across tenants".($dryRun ? ' (dry-run)' : '').'.');

        return self::SUCCESS;
    }
}
