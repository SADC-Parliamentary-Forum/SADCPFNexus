<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\User;
use App\Services\NotificationService;

/**
 * Checks all active budget lines and dispatches notifications when:
 *  - utilisation >= 80 %  →  "budget.warning" (nearing limit)
 *  - utilisation >= 100 % →  "budget.exceeded" (over budget)
 *
 * Run daily via the scheduler (see routes/console.php).
 */
class CheckBudgetVariance extends Command
{
    protected $signature   = 'budget:check-variance';
    protected $description = 'Notify Finance Controller and SG when budget lines approach or exceed their allocated amount';

    public function handle(NotificationService $notif): int
    {
        $warned   = 0;
        $exceeded = 0;

        // Only check lines in the current fiscal year
        $currentYear = now()->year;

        $lines = BudgetLine::whereHas('budget', fn ($q) => $q->where('year', $currentYear))
            ->with('budget')
            ->get();

        foreach ($lines as $line) {
            if ($line->amount_allocated <= 0) {
                continue;
            }

            $utilisation = $line->amount_spent / $line->amount_allocated;

            if ($utilisation < 0.80) {
                continue;
            }

            $trigger = $utilisation >= 1.0 ? 'budget.exceeded' : 'budget.warning';

            // Resolve Finance Controller(s) and Secretary General for this tenant
            $recipients = User::where('tenant_id', $line->budget->tenant_id)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', [
                    'finance_controller',
                    'Finance Controller',
                    'secretary_general',
                    'Secretary General',
                ]))
                ->get();

            if ($recipients->isEmpty()) {
                continue;
            }

            $pct = round($utilisation * 100);

            $notif->dispatchToMany($recipients, $trigger, [
                'description' => sprintf(
                    "Budget line '%s' (%s) in budget '%s' (%s) is at %d%% utilisation. Allocated: %s %s | Spent: %s %s.",
                    $line->description ?? $line->category,
                    $line->account_code ?? '—',
                    $line->budget->name,
                    $line->budget->year,
                    $pct,
                    $line->budget->currency,
                    number_format($line->amount_allocated, 2),
                    $line->budget->currency,
                    number_format($line->amount_spent, 2),
                ),
                'reference' => $line->account_code ?? "LINE-{$line->id}",
                'amount'    => number_format($line->amount_allocated, 2) . ' ' . $line->budget->currency,
            ], [
                'module' => 'finance',
                'url'    => "/finance/budget/{$line->budget_id}",
            ]);

            $utilisation >= 1.0 ? $exceeded++ : $warned++;
        }

        $this->info("Budget variance check complete. Warned: {$warned}, Exceeded: {$exceeded}.");

        return self::SUCCESS;
    }
}
