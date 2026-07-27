<?php

namespace App\Console\Commands;

use App\Models\BudgetVariance;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Budget\Services\BudgetVarianceService;
use App\Services\NotificationService;
use Illuminate\Console\Command;

/**
 * Snapshots YTD budget variances and notifies Finance/SG when:
 *  - significant variance (|budget−actual|/budget ≥ threshold, default 20%)
 *  - utilisation warnings from availability (legacy 80%/100% alerts)
 *
 * Run weekdays 07:00 via scheduler.
 */
class CheckBudgetVariance extends Command
{
    protected $signature = 'budget:check-variance {--tenant= : Limit to one tenant id}';

    protected $description = 'Snapshot budget variances and notify Finance when significant or over-utilised';

    public function handle(BudgetVarianceService $variances, NotificationService $notif): int
    {
        $tenantQuery = Tenant::query();
        if ($this->option('tenant')) {
            $tenantQuery->whereKey((int) $this->option('tenant'));
        }

        $warned = 0;
        $exceeded = 0;
        $significant = 0;

        foreach ($tenantQuery->cursor() as $tenant) {
            $result = $variances->scanTenant((int) $tenant->id);
            $significant += $result['significant'];

            $rows = BudgetVariance::query()
                ->with('budgetLine.budget')
                ->where('tenant_id', $tenant->id)
                ->where('period_type', 'ytd')
                ->whereDate('as_of_date', now()->toDateString())
                ->get();

            $recipients = User::where('tenant_id', $tenant->id)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', [
                    'Finance Controller',
                    'Secretary General',
                ]))
                ->get();

            if ($recipients->isEmpty()) {
                continue;
            }

            foreach ($rows as $row) {
                $line = $row->budgetLine;
                if (! $line) {
                    continue;
                }

                $label = $line->displayName();
                $url = '/budget/variance';

                if ($row->is_significant && $row->status === 'explanation_required') {
                    $notif->dispatchToMany($recipients, 'budget.warning', [
                        'description' => sprintf(
                            "Significant budget variance on '%s': %.1f%% (approved %s, actual %s). Explanation required.",
                            $label,
                            (float) $row->variance_pct,
                            number_format((float) $row->approved_budget, 2),
                            number_format((float) $row->actual_expenditure, 2),
                        ),
                        'reference' => $line->code ?? "LINE-{$line->id}",
                        'amount' => number_format((float) $row->variance_amount, 2),
                    ], [
                        'module' => 'budget',
                        'url' => $url,
                    ]);
                    $warned++;
                }

                $util = (float) ($row->utilisation_pct ?? 0);
                if ($util >= 100) {
                    $notif->dispatchToMany($recipients, 'budget.exceeded', [
                        'description' => sprintf(
                            "Budget line '%s' utilisation is %.0f%% (available %s).",
                            $label,
                            $util,
                            number_format((float) $row->available_budget, 2),
                        ),
                        'reference' => $line->code ?? "LINE-{$line->id}",
                        'amount' => number_format((float) $row->approved_budget, 2),
                    ], [
                        'module' => 'budget',
                        'url' => $url,
                    ]);
                    $exceeded++;
                } elseif ($util >= 80) {
                    $notif->dispatchToMany($recipients, 'budget.warning', [
                        'description' => sprintf(
                            "Budget line '%s' utilisation is %.0f%%.",
                            $label,
                            $util,
                        ),
                        'reference' => $line->code ?? "LINE-{$line->id}",
                        'amount' => number_format((float) $row->approved_budget, 2),
                    ], [
                        'module' => 'budget',
                        'url' => $url,
                    ]);
                    $warned++;
                }
            }
        }

        $this->info("Budget variance check complete. Significant: {$significant}, Warned: {$warned}, Exceeded: {$exceeded}.");

        return self::SUCCESS;
    }
}
