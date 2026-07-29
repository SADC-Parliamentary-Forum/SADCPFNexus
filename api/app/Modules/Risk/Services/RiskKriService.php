<?php

namespace App\Modules\Risk\Services;

use App\Models\Assignment;
use App\Models\BudgetVariance;
use App\Models\LeaveRequest;
use App\Models\Risk;
use App\Models\RiskKri;
use App\Models\RiskKriReading;
use App\Models\StockItem;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RiskKriService
{
    /**
     * Documented catalog of automated KRI definitions and Nexus data sources.
     *
     * @return list<array<string, mixed>>
     */
    public function catalog(): array
    {
        return [
            [
                'code' => 'BUDGET_VARIANCE_PCT',
                'name' => 'Max significant budget variance %',
                'source_module' => 'budget',
                'source_key' => 'max_significant_variance_pct',
                'unit' => 'percent',
                'direction' => 'higher_is_worse',
                'warning_threshold' => 15,
                'breach_threshold' => 25,
                'data_source' => 'budget_variances.variance_pct where is_significant = true (absolute max)',
                'description' => 'Largest absolute significant budget line variance percentage in the tenant.',
            ],
            [
                'code' => 'OVERDUE_ASSIGNMENTS',
                'name' => 'Overdue open assignments',
                'source_module' => 'assignments',
                'source_key' => 'overdue_open_count',
                'unit' => 'count',
                'direction' => 'higher_is_worse',
                'warning_threshold' => 5,
                'breach_threshold' => 15,
                'data_source' => 'assignments where due_date < today and status not in completed/closed/cancelled',
                'description' => 'Count of open assignments past due date (includes risk-sourced treatments).',
            ],
            [
                'code' => 'LEAVE_APPROVAL_BACKLOG',
                'name' => 'Leave approval backlog (>5 days)',
                'source_module' => 'leave',
                'source_key' => 'submitted_older_than_5_days',
                'unit' => 'count',
                'direction' => 'higher_is_worse',
                'warning_threshold' => 3,
                'breach_threshold' => 10,
                'data_source' => 'leave_requests.status = submitted and submitted_at <= now()-5 days',
                'description' => 'Leave requests still awaiting approval for more than five calendar days.',
            ],
            [
                'code' => 'STOCK_STOCKOUTS',
                'name' => 'Stock stockouts / at-or-below reorder',
                'source_module' => 'stock',
                'source_key' => 'stockout_or_low_count',
                'unit' => 'count',
                'direction' => 'higher_is_worse',
                'warning_threshold' => 3,
                'breach_threshold' => 10,
                'data_source' => 'stock_items where current_balance <= 0 OR (reorder_level > 0 AND available <= reorder_level)',
                'description' => 'Active stock items at zero balance or at/below reorder level.',
            ],
            [
                'code' => 'UNRESOLVED_HIGH_RISKS',
                'name' => 'Unresolved high / critical risks',
                'source_module' => 'risk',
                'source_key' => 'open_high_critical_count',
                'unit' => 'count',
                'direction' => 'higher_is_worse',
                'warning_threshold' => 3,
                'breach_threshold' => 8,
                'data_source' => 'risks where risk_level in (high,critical) and status not in (closed,archived) and deleted_at is null',
                'description' => 'Open register risks currently rated high or critical.',
            ],
        ];
    }

    public function ensureDefaults(int $tenantId): void
    {
        foreach ($this->catalog() as $def) {
            RiskKri::firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $def['code']],
                [
                    'name' => $def['name'],
                    'description' => $def['description'],
                    'source_module' => $def['source_module'],
                    'source_key' => $def['source_key'],
                    'unit' => $def['unit'],
                    'direction' => $def['direction'],
                    'warning_threshold' => $def['warning_threshold'],
                    'breach_threshold' => $def['breach_threshold'],
                    'enabled' => true,
                ]
            );
        }
    }

    /**
     * @return Collection<int, RiskKri>
     */
    public function listForTenant(int $tenantId): Collection
    {
        $this->ensureDefaults($tenantId);

        return RiskKri::query()
            ->where('tenant_id', $tenantId)
            ->with(['risk:id,risk_code,title', 'strategicObjective:id,code,title'])
            ->orderBy('code')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(RiskKri $kri, array $data): RiskKri
    {
        $kri->fill(array_intersect_key($data, array_flip([
            'name',
            'description',
            'warning_threshold',
            'breach_threshold',
            'risk_id',
            'strategic_objective_id',
            'enabled',
        ])));
        $kri->save();

        return $kri->fresh(['risk:id,risk_code,title', 'strategicObjective:id,code,title']);
    }

    /**
     * @return Collection<int, RiskKri>
     */
    public function evaluateTenant(int $tenantId, bool $notify = true): Collection
    {
        $this->ensureDefaults($tenantId);

        $kris = RiskKri::query()
            ->where('tenant_id', $tenantId)
            ->where('enabled', true)
            ->get();

        foreach ($kris as $kri) {
            $this->evaluateKri($kri, $notify);
        }

        return $this->listForTenant($tenantId);
    }

    public function evaluateKri(RiskKri $kri, bool $notify = true): RiskKriReading
    {
        [$value, $meta] = $this->collectValue($kri);

        $status = $this->classify($kri, $value);

        return DB::transaction(function () use ($kri, $value, $status, $meta, $notify) {
            $reading = RiskKriReading::create([
                'tenant_id' => $kri->tenant_id,
                'risk_kri_id' => $kri->id,
                'value' => $value,
                'status' => $status,
                'evaluated_at' => now(),
                'meta' => $meta,
            ]);

            $kri->update([
                'last_value' => $value,
                'last_status' => $status,
                'last_evaluated_at' => now(),
            ]);

            if ($notify && $status === 'breach') {
                $this->notifyBreach($kri->fresh(), $reading);
            }

            return $reading->fresh();
        });
    }

    /**
     * @return array{0: float, 1: array<string, mixed>}
     */
    public function collectValue(RiskKri $kri): array
    {
        return match ($kri->source_key) {
            'max_significant_variance_pct' => $this->collectBudgetVariancePct((int) $kri->tenant_id),
            'overdue_open_count' => $this->collectOverdueAssignments((int) $kri->tenant_id),
            'submitted_older_than_5_days' => $this->collectLeaveBacklog((int) $kri->tenant_id),
            'stockout_or_low_count' => $this->collectStockouts((int) $kri->tenant_id),
            'open_high_critical_count' => $this->collectUnresolvedHighRisks((int) $kri->tenant_id),
            default => [0.0, ['error' => 'unknown_source_key', 'source_key' => $kri->source_key]],
        };
    }

    public function classify(RiskKri $kri, float $value): string
    {
        $breach = $kri->breach_threshold;
        $warning = $kri->warning_threshold;
        $higherIsWorse = ($kri->direction ?? 'higher_is_worse') === 'higher_is_worse';

        if ($breach !== null) {
            if ($higherIsWorse && $value >= (float) $breach) {
                return 'breach';
            }
            if (! $higherIsWorse && $value <= (float) $breach) {
                return 'breach';
            }
        }

        if ($warning !== null) {
            if ($higherIsWorse && $value >= (float) $warning) {
                return 'warning';
            }
            if (! $higherIsWorse && $value <= (float) $warning) {
                return 'warning';
            }
        }

        return 'ok';
    }

    /**
     * @return array{0: float, 1: array<string, mixed>}
     */
    private function collectBudgetVariancePct(int $tenantId): array
    {
        $max = BudgetVariance::query()
            ->where('tenant_id', $tenantId)
            ->where('is_significant', true)
            ->selectRaw('MAX(ABS(variance_pct)) as max_pct')
            ->value('max_pct');

        return [(float) ($max ?? 0), ['table' => 'budget_variances', 'metric' => 'max_abs_significant_variance_pct']];
    }

    /**
     * @return array{0: float, 1: array<string, mixed>}
     */
    private function collectOverdueAssignments(int $tenantId): array
    {
        $count = Assignment::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('due_date')
            ->where('due_date', '<', now()->toDateString())
            ->whereNotIn('status', ['completed', 'closed', 'cancelled'])
            ->count();

        return [(float) $count, ['table' => 'assignments', 'metric' => 'overdue_open_count']];
    }

    /**
     * @return array{0: float, 1: array<string, mixed>}
     */
    private function collectLeaveBacklog(int $tenantId): array
    {
        $count = LeaveRequest::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'submitted')
            ->whereNotNull('submitted_at')
            ->where('submitted_at', '<=', now()->subDays(5))
            ->count();

        return [(float) $count, ['table' => 'leave_requests', 'metric' => 'submitted_older_than_5_days']];
    }

    /**
     * @return array{0: float, 1: array<string, mixed>}
     */
    private function collectStockouts(int $tenantId): array
    {
        $items = StockItem::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('status', 'active')->orWhereNull('status');
            })
            ->get(['id', 'current_balance', 'quantity_reserved', 'quantity_quarantined', 'reorder_level']);

        $count = $items->filter(function (StockItem $item) {
            $available = max(
                0,
                (int) $item->current_balance - (int) $item->quantity_reserved - (int) $item->quantity_quarantined
            );
            if ((int) $item->current_balance <= 0) {
                return true;
            }

            return (int) $item->reorder_level > 0 && $available <= (int) $item->reorder_level;
        })->count();

        return [(float) $count, ['table' => 'stock_items', 'metric' => 'stockout_or_low_count']];
    }

    /**
     * @return array{0: float, 1: array<string, mixed>}
     */
    private function collectUnresolvedHighRisks(int $tenantId): array
    {
        $count = Risk::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('risk_level', ['high', 'critical'])
            ->whereNotIn('status', ['closed', 'archived'])
            ->count();

        return [(float) $count, ['table' => 'risks', 'metric' => 'open_high_critical_count']];
    }

    private function notifyBreach(RiskKri $kri, RiskKriReading $reading): void
    {
        $recipients = User::query()
            ->where('tenant_id', $kri->tenant_id)
            ->where('is_active', true)
            ->whereHas('roles', function ($q) {
                $q->whereIn('name', ['Governance Officer', 'Secretary General', 'System Admin', 'Director']);
            })
            ->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $notifications = app(NotificationService::class);
        $notifications->dispatchToMany(
            $recipients,
            'risk.kri_breached',
            [
                'kri_code' => $kri->code,
                'kri_name' => $kri->name,
                'value' => (string) $reading->value,
                'threshold' => (string) $kri->breach_threshold,
                'unit' => $kri->unit,
            ],
            [
                'module' => 'risk',
                'record_id' => $kri->id,
                'url' => '/risk/kri',
                'kri_code' => $kri->code,
                'status' => 'breach',
            ],
            false
        );

        $reading->update(['breach_notified_at' => now()]);
    }
}
