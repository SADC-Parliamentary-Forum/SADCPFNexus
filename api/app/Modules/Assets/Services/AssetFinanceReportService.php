<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetDepreciationRunLine;
use App\Models\AssetDisposal;
use App\Models\AssetRevaluation;
use App\Models\BudgetActualTransaction;
use App\Models\BudgetLine;
use App\Models\GlJournal;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class AssetFinanceReportService
{
    /**
     * @param  array<string, mixed>  $params
     * @return array{title:string,scope:array<string,mixed>,columns:list<array<string,string>>,data:list<array<string,mixed>>,totals:array<string,mixed>,exceptions:list<array<string,mixed>>,declaration:?string}
     */
    public function build(User $actor, string $reportId, array $params): array
    {
        abort_unless(AssetAccess::canViewFinancials($actor), 403, 'Financial reports require finance permission.');

        return match ($reportId) {
            'R21' => $this->depreciationSchedule($actor, $params),
            'R22' => $this->nbvByClass($actor),
            'R23' => $this->fullyDepreciatedInUse($actor),
            'R24' => $this->capexVsBudget($actor, $params),
            'R25' => $this->additionsReconciliation($actor, $params),
            'R26' => $this->disposalsReconciliation($actor, $params),
            'R27' => $this->depreciationExceptions($actor),
            'R28' => $this->impairmentAndRevaluation($actor),
            'R29' => $this->fundingSourceSchedule($actor),
            default => abort(404, 'Unknown finance report.'),
        };
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function depreciationSchedule(User $actor, array $params): array
    {
        [$from, $to] = $this->period($params);
        $assets = $this->capitalAssets($actor)->get();
        $charges = $this->latestCharges($assets->pluck('id'));
        $rows = $assets->map(function (Asset $asset) use ($from, $to, $charges) {
            $charge = (float) ($charges[$asset->id]->depreciation_amount ?? 0);
            $cost = (float) ($asset->purchase_value ?? 0);
            $residual = (float) ($asset->salvage_value ?? 0);
            $closingNbv = $asset->book_value !== null ? (float) $asset->book_value : max($residual, $cost - (float) ($asset->accumulated_depreciation ?? 0));
            $closingAccum = $asset->accumulated_depreciation !== null ? (float) $asset->accumulated_depreciation : max(0, $cost - $closingNbv);
            $openingNbv = $closingNbv + $charge;
            $openingAccum = max(0, $closingAccum - $charge);
            $acquired = $this->acquiredInPeriod($asset, $from, $to);
            $disposed = $this->disposed($asset);
            $years = $asset->useful_life_years ? (int) $asset->useful_life_years : null;
            $start = $asset->capitalisation_date ?? $asset->purchase_date;

            return [
                'asset_id' => $asset->id,
                'asset_tag' => $asset->tag_number ?: $asset->asset_code,
                'class' => $asset->category ?: $asset->asset_class,
                'capitalisation_date' => optional($start)->toDateString(),
                'purchase_value' => $cost,
                'useful_life_years' => $years,
                'depreciation_method' => $asset->depreciation_method ?: 'straight_line',
                'rate_pct' => $years ? round(100 / $years, 2) : null,
                'salvage_value' => $residual,
                'opening_accumulated_depreciation' => round($openingAccum, 2),
                'opening_book_value' => round($openingNbv, 2),
                'additions' => $acquired ? $cost : 0,
                'disposals' => $disposed ? $cost : 0,
                'depreciation_charge' => round($charge, 2),
                'closing_cost' => $disposed ? 0 : $cost,
                'accumulated_depreciation' => round($closingAccum, 2),
                'book_value' => round($closingNbv, 2),
                'remaining_life_years' => $years && $start ? max(0, $years - (int) $start->diffInYears($to)) : $years,
                'funding_source' => $asset->funding_source,
                'department' => $asset->department,
            ];
        })->values()->all();

        return [
            'title' => 'Depreciation schedule',
            'scope' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'columns' => $this->columns([
                'asset_tag', 'class', 'capitalisation_date', 'purchase_value', 'useful_life_years',
                'depreciation_method', 'rate_pct', 'salvage_value', 'opening_book_value',
                'additions', 'disposals', 'depreciation_charge', 'accumulated_depreciation',
                'book_value', 'remaining_life_years',
            ]),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'purchase_value' => collect($rows)->sum('purchase_value'),
                'depreciation_charge' => collect($rows)->sum('depreciation_charge'),
                'book_value' => collect($rows)->sum('book_value'),
            ],
            'exceptions' => $this->exceptionRows($assets, $charges),
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nbvByClass(User $actor): array
    {
        $assets = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) {
                $q->whereNull('asset_class')->orWhere('asset_class', '!=', 'controlled');
            })
            ->whereNotIn('status', ['draft', 'pending'])
            ->get();
        $rows = $assets->groupBy(fn (Asset $asset) => $asset->category ?: $asset->asset_class ?: 'uncategorised')
            ->map(function (Collection $group, string $class) {
                $cost = $group->sum(fn (Asset $asset) => (float) ($asset->purchase_value ?? 0));
                $accum = $group->sum(fn (Asset $asset) => (float) ($asset->accumulated_depreciation ?? 0));
                $nbv = $group->sum(fn (Asset $asset) => (float) ($asset->book_value ?? 0));

                return [
                    'class' => $class,
                    'count' => $group->count(),
                    'purchase_value' => round($cost, 2),
                    'accumulated_depreciation' => round($accum, 2),
                    'book_value' => round($nbv, 2),
                ];
            })->values()->all();

        return [
            'title' => 'Net book value by class',
            'scope' => [],
            'columns' => $this->columns(['class', 'count', 'purchase_value', 'accumulated_depreciation', 'book_value']),
            'data' => $rows,
            'totals' => [
                'count' => $assets->count(),
                'classes' => count($rows),
                'purchase_value' => collect($rows)->sum('purchase_value'),
                'book_value' => collect($rows)->sum('book_value'),
            ],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function fullyDepreciatedInUse(User $actor): array
    {
        $rows = $this->capitalAssets($actor)
            ->whereNotIn('status', Asset::DISPOSED_STATUSES)
            ->get()
            ->filter(function (Asset $asset) {
                $residual = (float) ($asset->salvage_value ?? 0);
                $nbv = $asset->book_value !== null ? (float) $asset->book_value : null;

                return $nbv !== null && $nbv <= max(0.01, $residual);
            })
            ->map(fn (Asset $asset) => $this->financeRow($asset, [
                'exception_reason' => 'fully_depreciated_in_use',
            ]))
            ->values()
            ->all();

        return [
            'title' => 'Fully depreciated assets still in use',
            'scope' => [],
            'columns' => $this->columns(['asset_tag', 'description', 'class', 'purchase_value', 'salvage_value', 'book_value', 'asset_status']),
            'data' => $rows,
            'totals' => ['count' => count($rows), 'purchase_value' => collect($rows)->sum('purchase_value')],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function additionsReconciliation(User $actor, array $params): array
    {
        [$from, $to] = $this->period($params);
        $assets = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('purchase_date', [$from, $to])
                    ->orWhereBetween('received_date', [$from, $to])
                    ->orWhereBetween('capitalisation_date', [$from, $to]);
            })
            ->orderByDesc('purchase_date')
            ->limit(5000)
            ->get();
        $rows = $assets->map(function (Asset $asset) {
            $matched = filled($asset->invoice_number) || filled($asset->purchase_order_id);
            $reason = ! $matched ? 'unmatched_procurement' : (blank($asset->purchase_value) ? 'missing_cost' : null);

            return $this->financeRow($asset, [
                'invoice_number' => $asset->invoice_number,
                'purchase_order_id' => $asset->purchase_order_id,
                'acquisition_date' => optional($asset->capitalisation_date ?? $asset->received_date ?? $asset->purchase_date)->toDateString(),
                'matched' => $matched,
                'exception_reason' => $reason,
            ]);
        })->all();
        $exceptions = collect($rows)->whereNotNull('exception_reason')->values()->all();

        return [
            'title' => 'Asset additions reconciliation',
            'scope' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'columns' => $this->columns([
                'asset_tag', 'description', 'acquisition_date', 'invoice_number', 'purchase_value', 'funding_source', 'matched',
            ]),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'matched' => collect($rows)->where('matched', true)->count(),
                'unmatched' => count($exceptions),
                'purchase_value' => collect($rows)->sum('purchase_value'),
            ],
            'exceptions' => $exceptions,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function depreciationExceptions(User $actor): array
    {
        $assets = $this->capitalAssets($actor, includeDisposed: true)->get();
        $charges = $this->latestCharges($assets->pluck('id'));
        $rows = $this->exceptionRows($assets, $charges);

        return [
            'title' => 'Depreciation exceptions',
            'scope' => [],
            'columns' => $this->columns([
                'asset_tag', 'description', 'class', 'useful_life_years', 'rate_pct',
                'purchase_value', 'book_value', 'asset_status', 'exception_reason',
            ]),
            'data' => $rows,
            'totals' => ['count' => count($rows)],
            'exceptions' => $rows,
            'declaration' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function fundingSourceSchedule(User $actor): array
    {
        $assets = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotIn('status', ['draft'])
            ->get();
        $rows = $assets->groupBy(function (Asset $asset) {
            if (filled($asset->funding_source)) {
                return $asset->funding_source;
            }

            return filled($asset->donor_name) ? 'donor' : 'core';
        })->map(function (Collection $group, string $source) {
            return [
                'funding_source' => $source,
                'count' => $group->count(),
                'purchase_value' => round($group->sum(fn (Asset $asset) => (float) ($asset->purchase_value ?? 0)), 2),
                'accumulated_depreciation' => round($group->sum(fn (Asset $asset) => (float) ($asset->accumulated_depreciation ?? 0)), 2),
                'book_value' => round($group->sum(fn (Asset $asset) => (float) ($asset->book_value ?? 0)), 2),
                'donor_name' => $group->pluck('donor_name')->filter()->unique()->implode(', ') ?: null,
            ];
        })->values()->all();

        return [
            'title' => 'Funding source schedule',
            'scope' => [],
            'columns' => $this->columns(['funding_source', 'donor_name', 'count', 'purchase_value', 'accumulated_depreciation', 'book_value']),
            'data' => $rows,
            'totals' => [
                'count' => $assets->count(),
                'sources' => count($rows),
                'purchase_value' => collect($rows)->sum('purchase_value'),
                'book_value' => collect($rows)->sum('book_value'),
            ],
            'exceptions' => [],
            'declaration' => null,
        ];
    }

    /**
     * Capital budget lines vs register acquisitions. String-match only — no invented FK.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function capexVsBudget(User $actor, array $params): array
    {
        [$from, $to] = $this->period($params);
        $availability = app(BudgetAvailabilityService::class);
        $lines = BudgetLine::query()
            ->whereHas('budget', fn ($q) => $q->where('tenant_id', $actor->tenant_id))
            ->where(function ($q) {
                $q->whereIn('category', ['capital', 'capex'])
                    ->orWhere('code', 'like', 'CAPEX%')
                    ->orWhere('code', 'like', 'CAP-%');
            })
            ->orderBy('code')
            ->get();
        $capitalAssets = $this->capitalAssets($actor, includeDisposed: true)
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('purchase_date', [$from->toDateString(), $to->toDateString()])
                    ->orWhereBetween('capitalisation_date', [$from->toDateString(), $to->toDateString()])
                    ->orWhereNotNull('budget_line');
            })
            ->get();
        $rows = $lines->map(function (BudgetLine $line) use ($availability, $capitalAssets) {
            $check = $availability->check($line->id);
            $register = $capitalAssets->filter(function (Asset $asset) use ($line) {
                return filled($asset->budget_line) && strcasecmp((string) $asset->budget_line, (string) $line->code) === 0;
            });
            $registerCost = round($register->sum(fn (Asset $asset) => (float) ($asset->purchase_value ?? 0)), 2);
            $gap = abs($registerCost - (float) $check['actual']) > 0.01;

            return [
                'budget_code' => $line->code,
                'budget_name' => $line->displayName(),
                'approved' => $check['approved'],
                'commitments' => $check['commitments'],
                'actual' => $check['actual'],
                'available' => $check['available'],
                'register_acquisitions' => $registerCost,
                'register_count' => $register->count(),
                'match_status' => $gap ? 'register_vs_budget_actual_differs' : 'aligned',
            ];
        })->values()->all();
        $unmatched = $capitalAssets->filter(function (Asset $asset) use ($lines) {
            if (! filled($asset->budget_line)) {
                return true;
            }

            return $lines->first(fn (BudgetLine $line) => strcasecmp((string) $line->code, (string) $asset->budget_line) === 0) === null;
        })->map(fn (Asset $asset) => $this->financeRow($asset, [
            'budget_code' => $asset->budget_line,
            'exception_reason' => filled($asset->budget_line) ? 'unknown_budget_line' : 'missing_budget_line',
        ]))->values()->all();

        return [
            'title' => 'Capital expenditure vs budget',
            'scope' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'columns' => $this->columns([
                'budget_code', 'budget_name', 'approved', 'commitments', 'actual', 'available', 'register_acquisitions', 'register_count', 'match_status',
            ]),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'approved' => collect($rows)->sum('approved'),
                'register_acquisitions' => collect($rows)->sum('register_acquisitions'),
                'unmatched_assets' => count($unmatched),
            ],
            'exceptions' => $unmatched,
            'declaration' => 'Register acquisitions are matched to budget lines by budget_line code only. There is no posted capex ledger link.',
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function disposalsReconciliation(User $actor, array $params): array
    {
        [$from, $to] = $this->period($params);
        $refs = BudgetActualTransaction::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotNull('accounting_reference')
            ->pluck('accounting_reference')
            ->merge(
                GlJournal::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->pluck('journal_no')
            )
            ->filter()
            ->map(fn ($ref) => strtoupper((string) $ref))
            ->unique();
        $rows = AssetDisposal::query()
            ->with(['asset', 'requester'])
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('completed_at', [$from, $to])
                    ->orWhereBetween('created_at', [$from, $to]);
            })
            ->orderByDesc('id')
            ->get()
            ->map(function (AssetDisposal $row) use ($refs) {
                $ref = strtoupper((string) ($row->accounting_reference ?: ''));
                $matched = $ref !== '' && $refs->contains($ref);

                return [
                    'asset_id' => $row->asset_id,
                    'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
                    'description' => $row->asset?->name,
                    'reference' => $row->reference,
                    'disposal_status' => $row->status,
                    'method' => $row->method,
                    'proceeds' => $row->proceeds,
                    'book_value' => $row->asset?->book_value,
                    'accounting_reference' => $row->accounting_reference,
                    'gl_matched' => $matched,
                    'exception_reason' => $matched || $row->status !== 'completed' ? null : 'unmatched_gl',
                ];
            })->all();
        $covered = collect($rows)->pluck('asset_id')->filter()->all();
        $orphans = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('status', Asset::DISPOSED_STATUSES)
            ->when($covered !== [], fn ($q) => $q->whereNotIn('id', $covered))
            ->get()
            ->map(fn (Asset $asset) => $this->financeRow($asset, [
                'reference' => null,
                'exception_reason' => 'disposed_without_disposal_record',
                'gl_matched' => false,
            ]))
            ->all();
        $exceptions = collect($rows)->whereNotNull('exception_reason')->values()->merge($orphans)->all();

        return [
            'title' => 'Disposals reconciliation',
            'scope' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'columns' => $this->columns([
                'asset_tag', 'description', 'reference', 'disposal_status', 'method', 'proceeds', 'book_value', 'accounting_reference', 'gl_matched',
            ]),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'matched' => collect($rows)->where('gl_matched', true)->count(),
                'proceeds' => collect($rows)->sum('proceeds'),
            ],
            'exceptions' => $exceptions,
            'declaration' => 'GL match is by accounting_reference against budget actuals or posted journal numbers. Disposal completion does not auto-post a journal.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function impairmentAndRevaluation(User $actor): array
    {
        $rows = AssetRevaluation::query()
            ->with(['asset', 'requester', 'approver'])
            ->where('tenant_id', $actor->tenant_id)
            ->orderByDesc('id')
            ->limit(2500)
            ->get()
            ->map(function (AssetRevaluation $row) {
                $previous = (float) ($row->previous_book_value ?? 0);
                $proposed = (float) ($row->proposed_value ?? 0);

                return [
                    'asset_id' => $row->asset_id,
                    'asset_tag' => $row->asset?->tag_number ?: $row->asset?->asset_code,
                    'description' => $row->asset?->name,
                    'adjustment_type' => 'revaluation',
                    'previous_book_value' => $previous,
                    'proposed_value' => $proposed,
                    'adjustment' => round($proposed - $previous, 2),
                    'status' => $row->status,
                    'effective_date' => optional($row->effective_date)->toDateString(),
                    'reason' => $row->reason,
                    'approved_by' => $row->approver?->name,
                    'exception_reason' => $row->status === 'pending' ? 'pending_approval' : null,
                ];
            })->all();

        return [
            'title' => 'Impairment and revaluation',
            'scope' => [],
            'columns' => $this->columns([
                'asset_tag', 'description', 'adjustment_type', 'previous_book_value', 'proposed_value', 'adjustment', 'status', 'effective_date', 'reason',
            ]),
            'data' => $rows,
            'totals' => [
                'count' => count($rows),
                'revaluations' => count($rows),
                'impairments' => 0,
            ],
            'exceptions' => collect($rows)->whereNotNull('exception_reason')->values()->all(),
            'declaration' => 'Only approved or pending revaluations are sourced. Impairment amounts are not stored on the register and are not invented here.',
        ];
    }

    /**
     * @param  Collection<int, int|string>  $assetIds
     * @return Collection<int, AssetDepreciationRunLine>
     */
    private function latestCharges(Collection $assetIds): Collection
    {
        if ($assetIds->isEmpty()) {
            return collect();
        }

        return AssetDepreciationRunLine::query()
            ->whereIn('asset_id', $assetIds->all())
            ->orderByDesc('id')
            ->get()
            ->unique('asset_id')
            ->keyBy('asset_id');
    }

    /**
     * @param  Collection<int, Asset>  $assets
     * @param  Collection<int, AssetDepreciationRunLine>  $charges
     * @return list<array<string, mixed>>
     */
    private function exceptionRows(Collection $assets, Collection $charges): array
    {
        $rows = [];
        foreach ($assets as $asset) {
            $reasons = [];
            $years = $asset->useful_life_years;
            $nbv = $asset->book_value !== null ? (float) $asset->book_value : null;
            if ($years === null || (int) $years <= 0) {
                $reasons[] = 'missing_useful_life';
            }
            if ($years !== null && (int) $years <= 0) {
                $reasons[] = 'invalid_rate';
            }
            if ($nbv !== null && $nbv < 0) {
                $reasons[] = 'negative_nbv';
            }
            if ($this->disposed($asset) && (($nbv !== null && $nbv > 0.01) || isset($charges[$asset->id]))) {
                $reasons[] = 'disposed_but_depreciating';
            }
            if (! $this->disposed($asset) && ! isset($charges[$asset->id]) && $asset->purchase_value) {
                $reasons[] = 'unposted_batch';
            }
            $purchase = $asset->purchase_date;
            $cap = $asset->capitalisation_date;
            if ($purchase && $cap && $cap->gt($purchase->copy()->addDays(60))) {
                $reasons[] = 'late_capitalisation';
            }
            foreach ($reasons as $reason) {
                $rows[] = $this->financeRow($asset, [
                    'rate_pct' => $years ? round(100 / max(1, (int) $years), 2) : null,
                    'exception_reason' => $reason,
                ]);
            }
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function financeRow(Asset $asset, array $extra = []): array
    {
        return [
            'asset_id' => $asset->id,
            'asset_tag' => $asset->tag_number ?: $asset->asset_code,
            'description' => $asset->name,
            'class' => $asset->category ?: $asset->asset_class,
            'asset_status' => $asset->status,
            'funding_source' => $asset->funding_source,
            'useful_life_years' => $asset->useful_life_years,
            'purchase_value' => $asset->purchase_value,
            'salvage_value' => $asset->salvage_value,
            'accumulated_depreciation' => $asset->accumulated_depreciation,
            'book_value' => $asset->book_value,
            ...$extra,
        ];
    }

    /**
     * @param  list<string>  $keys
     * @return list<array{key:string,label:string,type:string}>
     */
    private function columns(array $keys): array
    {
        $labels = [
            'asset_tag' => 'Tag',
            'description' => 'Description',
            'class' => 'Class',
            'capitalisation_date' => 'Capitalisation date',
            'acquisition_date' => 'Acquisition date',
            'purchase_value' => 'Cost',
            'useful_life_years' => 'Useful life',
            'depreciation_method' => 'Method',
            'rate_pct' => 'Rate %',
            'salvage_value' => 'Residual',
            'opening_book_value' => 'Opening NBV',
            'additions' => 'Additions',
            'disposals' => 'Disposals',
            'depreciation_charge' => 'Depreciation',
            'accumulated_depreciation' => 'Accumulated depreciation',
            'book_value' => 'Net book value',
            'remaining_life_years' => 'Remaining life',
            'asset_status' => 'Status',
            'funding_source' => 'Funding',
            'donor_name' => 'Donor',
            'invoice_number' => 'Invoice',
            'matched' => 'Matched',
            'count' => 'Count',
            'exception_reason' => 'Exception',
            'budget_code' => 'Budget code',
            'budget_name' => 'Budget line',
            'approved' => 'Approved',
            'commitments' => 'Commitments',
            'actual' => 'Budget actuals',
            'available' => 'Available',
            'register_acquisitions' => 'Register acquisitions',
            'register_count' => 'Register count',
            'match_status' => 'Match',
            'reference' => 'Reference',
            'disposal_status' => 'Disposal status',
            'method' => 'Method',
            'proceeds' => 'Proceeds',
            'accounting_reference' => 'Accounting reference',
            'gl_matched' => 'GL matched',
            'adjustment_type' => 'Type',
            'previous_book_value' => 'Previous NBV',
            'proposed_value' => 'Proposed value',
            'adjustment' => 'Adjustment',
            'status' => 'Status',
            'effective_date' => 'Effective date',
            'reason' => 'Reason',
        ];
        $types = [
            'purchase_value' => 'number',
            'salvage_value' => 'number',
            'opening_book_value' => 'number',
            'additions' => 'number',
            'disposals' => 'number',
            'depreciation_charge' => 'number',
            'accumulated_depreciation' => 'number',
            'book_value' => 'number',
            'rate_pct' => 'number',
            'useful_life_years' => 'number',
            'remaining_life_years' => 'number',
            'count' => 'number',
            'approved' => 'number',
            'commitments' => 'number',
            'actual' => 'number',
            'available' => 'number',
            'register_acquisitions' => 'number',
            'register_count' => 'number',
            'proceeds' => 'number',
            'previous_book_value' => 'number',
            'proposed_value' => 'number',
            'adjustment' => 'number',
            'capitalisation_date' => 'date',
            'acquisition_date' => 'date',
            'effective_date' => 'date',
        ];

        return array_map(fn (string $key) => [
            'key' => $key,
            'label' => $labels[$key] ?? $key,
            'type' => $types[$key] ?? 'text',
        ], $keys);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array{0:Carbon,1:Carbon}
     */
    private function period(array $params): array
    {
        $to = isset($params['to'])
            ? Carbon::parse((string) $params['to'])->endOfDay()
            : (isset($params['as_of']) ? Carbon::parse((string) $params['as_of'])->endOfDay() : now()->endOfDay());
        $from = isset($params['from'])
            ? Carbon::parse((string) $params['from'])->startOfDay()
            : $to->copy()->startOfYear();

        return [$from, $to];
    }

    private function capitalAssets(User $actor, bool $includeDisposed = false)
    {
        $query = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where(function ($q) {
                $q->where('asset_class', 'capital')->orWhereNull('asset_class')->orWhere('asset_class', '');
            })
            ->orderBy('asset_code');
        if (! $includeDisposed) {
            $query->whereNotIn('status', Asset::DISPOSED_STATUSES);
        }

        return $query;
    }

    private function acquiredInPeriod(Asset $asset, Carbon $from, Carbon $to): bool
    {
        $date = $asset->capitalisation_date ?? $asset->received_date ?? $asset->purchase_date;

        return $date !== null && $date->betweenIncluded($from, $to);
    }

    private function disposed(Asset $asset): bool
    {
        return in_array($asset->status, Asset::DISPOSED_STATUSES, true);
    }
}
