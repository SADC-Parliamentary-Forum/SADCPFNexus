<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetActualTransaction;
use App\Models\BudgetReservation;
use App\Models\CashflowScenario;
use App\Models\FinancialYear;
use App\Models\ImprestRequest;
use App\Models\Invoice;
use App\Models\ProcurementRequest;
use App\Models\TravelRequest;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CashflowForecastService
{
    /**
     * @param  array{
     *   financial_year_id:int,
     *   scenario_id?:int|null,
     *   department_id?:int|null,
     *   funding_source_id?:int|null,
     *   as_of?:string|null
     * }  $filters
     * @return array<string, mixed>
     */
    public function forecast(int $tenantId, array $filters): array
    {
        $fyId = (int) ($filters['financial_year_id'] ?? 0);
        if ($fyId < 1) {
            throw ValidationException::withMessages([
                'financial_year_id' => ['A financial year is required.'],
            ]);
        }

        $fy = FinancialYear::query()
            ->where('tenant_id', $tenantId)
            ->whereKey($fyId)
            ->firstOrFail();

        $asOf = ! empty($filters['as_of'])
            ? Carbon::parse($filters['as_of'])->startOfDay()
            : Carbon::now()->startOfDay();

        $scenario = null;
        if (! empty($filters['scenario_id'])) {
            $scenario = CashflowScenario::query()
                ->with('adjustments')
                ->where('tenant_id', $tenantId)
                ->whereKey((int) $filters['scenario_id'])
                ->firstOrFail();
        }

        $periods = $this->buildPeriodKeys($fy);
        $periodMap = [];
        foreach ($periods as $period) {
            $periodMap[$period] = [
                'period' => $period,
                'actual_outflow' => 0.0,
                'projected_outflow' => 0.0,
                'scenario_inflow' => 0.0,
                'scenario_outflow' => 0.0,
                'net' => 0.0,
                'closing_balance' => 0.0,
            ];
        }

        $actuals = $this->loadActuals($tenantId, $fy, $filters);
        foreach ($actuals as $row) {
            $period = Carbon::parse($row->transaction_date)->format('Y-m');
            if (! isset($periodMap[$period])) {
                continue;
            }
            $periodMap[$period]['actual_outflow'] += (float) $row->amount;
        }

        $projected = $this->loadProjectedCommitments($tenantId, $fy, $filters);
        $items = [];
        $outOfRange = ['count' => 0, 'amount' => 0.0];

        foreach ($projected as $commitment) {
            $expected = $this->resolveExpectedCashDate($commitment);
            $period = $expected->format('Y-m');
            $amount = (float) $commitment->current_amount;
            $item = [
                'budget_reservation_id' => $commitment->id,
                'budget_line_id' => $commitment->budget_line_id,
                'budget_line_code' => $commitment->budgetLine?->code,
                'budget_line_name' => $commitment->budgetLine?->displayName(),
                'source_type' => $commitment->source_type,
                'source_id' => $commitment->source_id,
                'source_key' => $commitment->source_key,
                'status' => $commitment->status,
                'amount' => $amount,
                'currency' => $commitment->currency,
                'expected_cash_date' => $expected->toDateString(),
                'period' => $period,
                'resolution' => $commitment->_cash_resolution ?? 'fallback',
            ];
            $items[] = $item;

            if (! isset($periodMap[$period])) {
                $outOfRange['count']++;
                $outOfRange['amount'] += $amount;
                continue;
            }
            $periodMap[$period]['projected_outflow'] += $amount;
        }

        if ($scenario) {
            foreach ($scenario->adjustments as $adj) {
                $period = (string) $adj->period;
                if (! isset($periodMap[$period])) {
                    continue;
                }
                $amount = (float) $adj->amount;
                if ($adj->direction === 'inflow') {
                    $periodMap[$period]['scenario_inflow'] += $amount;
                } else {
                    $periodMap[$period]['scenario_outflow'] += $amount;
                }
            }
        }

        $opening = $scenario ? (float) $scenario->opening_balance : 0.0;
        $running = $opening;
        $totals = [
            'actual_outflow' => 0.0,
            'projected_outflow' => 0.0,
            'scenario_inflow' => 0.0,
            'scenario_outflow' => 0.0,
            'closing_balance' => $opening,
        ];

        $periodRows = [];
        foreach ($periodMap as $row) {
            $net = $row['scenario_inflow']
                - $row['actual_outflow']
                - $row['projected_outflow']
                - $row['scenario_outflow'];
            $running += $net;
            $row['net'] = round($net, 2);
            $row['actual_outflow'] = round($row['actual_outflow'], 2);
            $row['projected_outflow'] = round($row['projected_outflow'], 2);
            $row['scenario_inflow'] = round($row['scenario_inflow'], 2);
            $row['scenario_outflow'] = round($row['scenario_outflow'], 2);
            $row['closing_balance'] = round($running, 2);
            $periodRows[] = $row;

            $totals['actual_outflow'] += $row['actual_outflow'];
            $totals['projected_outflow'] += $row['projected_outflow'];
            $totals['scenario_inflow'] += $row['scenario_inflow'];
            $totals['scenario_outflow'] += $row['scenario_outflow'];
        }
        $totals['closing_balance'] = round($running, 2);
        $totals['actual_outflow'] = round($totals['actual_outflow'], 2);
        $totals['projected_outflow'] = round($totals['projected_outflow'], 2);
        $totals['scenario_inflow'] = round($totals['scenario_inflow'], 2);
        $totals['scenario_outflow'] = round($totals['scenario_outflow'], 2);
        $outOfRange['amount'] = round($outOfRange['amount'], 2);

        return [
            'financial_year' => [
                'id' => $fy->id,
                'code' => $fy->code,
                'label' => $fy->label,
                'starts_on' => optional($fy->starts_on)->toDateString() ?? (string) $fy->starts_on,
                'ends_on' => optional($fy->ends_on)->toDateString() ?? (string) $fy->ends_on,
            ],
            'scenario' => $scenario ? [
                'id' => $scenario->id,
                'name' => $scenario->name,
                'kind' => $scenario->kind,
                'status' => $scenario->status,
                'opening_balance' => (float) $scenario->opening_balance,
                'currency' => $scenario->currency,
            ] : null,
            'as_of' => $asOf->toDateString(),
            'currency' => $scenario?->currency ?? 'NAD',
            'opening_balance' => round($opening, 2),
            'periods' => $periodRows,
            'totals' => $totals,
            'out_of_range_projected' => $outOfRange,
            'items' => $items,
        ];
    }

    /**
     * @return list<string>
     */
    public function buildPeriodKeys(FinancialYear $fy): array
    {
        $start = Carbon::parse($fy->starts_on)->startOfMonth();
        $end = Carbon::parse($fy->ends_on)->startOfMonth();
        $keys = [];
        $cursor = $start->copy();
        while ($cursor->lte($end)) {
            $keys[] = $cursor->format('Y-m');
            $cursor->addMonth();
        }

        return $keys;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function loadActuals(int $tenantId, FinancialYear $fy, array $filters): Collection
    {
        return BudgetActualTransaction::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($fy) {
                $q->where('financial_year_id', $fy->id)
                    ->orWhere(function ($inner) use ($fy) {
                        $inner->whereNull('financial_year_id')
                            ->whereBetween('transaction_date', [
                                Carbon::parse($fy->starts_on)->toDateString(),
                                Carbon::parse($fy->ends_on)->toDateString(),
                            ]);
                    });
            })
            ->when(! empty($filters['department_id']) || ! empty($filters['funding_source_id']), function ($q) use ($filters) {
                $q->whereHas('budgetLine', function ($line) use ($filters) {
                    if (! empty($filters['department_id'])) {
                        $line->where('department_id', (int) $filters['department_id']);
                    }
                    if (! empty($filters['funding_source_id'])) {
                        $line->where('funding_source_id', (int) $filters['funding_source_id']);
                    }
                });
            })
            ->get(['id', 'budget_line_id', 'transaction_date', 'amount', 'base_currency_amount'])
            ->map(function (BudgetActualTransaction $row) {
                $row->amount = (float) ($row->base_currency_amount ?? $row->amount);

                return $row;
            });
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, BudgetReservation>
     */
    private function loadProjectedCommitments(int $tenantId, FinancialYear $fy, array $filters): Collection
    {
        return BudgetReservation::query()
            ->with(['budgetLine'])
            ->where('tenant_id', $tenantId)
            ->whereNull('released_at')
            ->whereIn('status', BudgetReservation::ACTIVE_STATUSES)
            ->where('current_amount', '>', 0)
            ->whereHas('budgetLine.budget', function ($q) use ($tenantId, $fy) {
                $q->where('tenant_id', $tenantId)
                    ->where('financial_year_id', $fy->id);
            })
            ->when(! empty($filters['department_id']), function ($q) use ($filters) {
                $q->whereHas('budgetLine', fn ($line) => $line->where('department_id', (int) $filters['department_id']));
            })
            ->when(! empty($filters['funding_source_id']), function ($q) use ($filters) {
                $q->whereHas('budgetLine', fn ($line) => $line->where('funding_source_id', (int) $filters['funding_source_id']));
            })
            ->get();
    }

    public function resolveExpectedCashDate(BudgetReservation $commitment): Carbon
    {
        $sourceType = strtolower((string) $commitment->source_type);

        if ($sourceType === 'invoice' && $commitment->source_id) {
            $due = Invoice::query()->whereKey($commitment->source_id)->value('due_date');
            if ($due) {
                $commitment->_cash_resolution = 'invoice.due_date';

                return Carbon::parse($due)->startOfDay();
            }
        }

        if ($sourceType === 'imprest' && $commitment->source_id) {
            $date = ImprestRequest::query()->whereKey($commitment->source_id)->value('expected_liquidation_date');
            if ($date) {
                $commitment->_cash_resolution = 'imprest.expected_liquidation_date';

                return Carbon::parse($date)->startOfDay();
            }
        }

        $travelId = $commitment->travel_request_id ?: ($sourceType === 'travel' ? $commitment->source_id : null);
        if ($travelId) {
            $date = TravelRequest::query()->whereKey($travelId)->value('departure_date');
            if ($date) {
                $commitment->_cash_resolution = 'travel.departure_date';

                return Carbon::parse($date)->startOfDay();
            }
        }

        $procId = $commitment->procurement_request_id ?: ($sourceType === 'procurement' ? $commitment->source_id : null);
        if ($procId) {
            $date = ProcurementRequest::query()->whereKey($procId)->value('required_by_date');
            if ($date) {
                $commitment->_cash_resolution = 'procurement.required_by_date';

                return Carbon::parse($date)->startOfDay();
            }
        }

        if ($commitment->confirmed_at) {
            $commitment->_cash_resolution = 'confirmed_at';

            return Carbon::parse($commitment->confirmed_at)->startOfDay();
        }

        if ($commitment->reserved_at) {
            $commitment->_cash_resolution = 'reserved_at';

            return Carbon::parse($commitment->reserved_at)->startOfDay();
        }

        $commitment->_cash_resolution = 'created_at';

        return Carbon::parse($commitment->created_at ?? now())->startOfDay();
    }
}
