<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetChangeRequest;
use App\Models\BudgetCycle;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\BudgetSubmission;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BudgetReportService
{
    public function __construct(
        private readonly BudgetAvailabilityService $availability,
    ) {}

    /**
     * @param  array{
     *   financial_year_id?:int|null,
     *   department_id?:int|null,
     *   funding_source_id?:int|null,
     *   group_by?:string,
     *   active_only?:bool
     * }  $filters
     * @return array{group_by:string,rows:list<array<string,mixed>>,totals:array<string,float|int>}
     */
    public function utilisation(int $tenantId, array $filters = []): array
    {
        $groupBy = $filters['group_by'] ?? 'line';
        if (! in_array($groupBy, ['line', 'department', 'funding_source'], true)) {
            $groupBy = 'line';
        }

        $lines = BudgetLine::query()
            ->with(['department', 'fundingSource', 'budget'])
            ->whereHas('budget', function ($q) use ($tenantId, $filters) {
                $q->where('tenant_id', $tenantId);
                if (! empty($filters['financial_year_id'])) {
                    $q->where('financial_year_id', (int) $filters['financial_year_id']);
                }
            })
            ->when(($filters['active_only'] ?? true) !== false, fn ($q) => $q->where('is_active', true))
            ->when(! empty($filters['department_id']), fn ($q) => $q->where('department_id', (int) $filters['department_id']))
            ->when(! empty($filters['funding_source_id']), fn ($q) => $q->where('funding_source_id', (int) $filters['funding_source_id']))
            ->orderBy('code')
            ->get();

        $lineRows = $lines->map(function (BudgetLine $line) {
            $check = $this->availability->check($line->id);
            $approved = (float) $check['approved'];
            $actual = (float) $check['actual'];
            $committed = (float) $check['commitments'];
            $available = (float) $check['available'];
            $utilised = $approved > 0 ? round((($approved - $available) / $approved) * 100, 2) : 0.0;

            return [
                'budget_line_id' => $line->id,
                'code' => $line->code,
                'name' => $line->displayName(),
                'department_id' => $line->department_id,
                'department_name' => $line->department?->name,
                'funding_source_id' => $line->funding_source_id,
                'funding_source_name' => $line->fundingSource?->name,
                'funding_source_code' => $line->fundingSource?->code,
                'budget_id' => $line->budget_id,
                'financial_year_id' => $line->budget?->financial_year_id,
                'approved' => $approved,
                'actual' => $actual,
                'committed' => $committed,
                'available' => $available,
                'pct_utilised' => $utilised,
            ];
        });

        $rows = match ($groupBy) {
            'department' => $this->rollupUtilisation($lineRows, 'department_id', 'department_name'),
            'funding_source' => $this->rollupUtilisation($lineRows, 'funding_source_id', 'funding_source_name', 'funding_source_code'),
            default => $lineRows->values()->all(),
        };

        return [
            'group_by' => $groupBy,
            'rows' => $rows,
            'totals' => $this->sumMoneyColumns($lineRows),
        ];
    }

    /**
     * @param  array{
     *   financial_year_id?:int|null,
     *   department_id?:int|null,
     *   funding_source_id?:int|null,
     *   as_of?:string|null
     * }  $filters
     * @return array{as_of:string,buckets:array<string,array{count:int,amount:float}>,items:list<array<string,mixed>>}
     */
    public function commitmentAgeing(int $tenantId, array $filters = []): array
    {
        $asOf = ! empty($filters['as_of'])
            ? Carbon::parse((string) $filters['as_of'])->endOfDay()
            : Carbon::now();

        $query = BudgetReservation::query()
            ->with(['budgetLine.budget', 'budgetLine.department', 'budgetLine.fundingSource'])
            ->where('tenant_id', $tenantId)
            ->whereNull('released_at')
            ->whereIn('status', BudgetReservation::ACTIVE_STATUSES)
            ->where('current_amount', '>', 0)
            ->when(! empty($filters['financial_year_id']), function ($q) use ($filters) {
                $q->whereHas('budgetLine.budget', fn ($b) => $b->where('financial_year_id', (int) $filters['financial_year_id']));
            })
            ->when(! empty($filters['department_id']), function ($q) use ($filters) {
                $q->whereHas('budgetLine', fn ($l) => $l->where('department_id', (int) $filters['department_id']));
            })
            ->when(! empty($filters['funding_source_id']), function ($q) use ($filters) {
                $q->whereHas('budgetLine', fn ($l) => $l->where('funding_source_id', (int) $filters['funding_source_id']));
            })
            ->orderBy('reserved_at')
            ->orderBy('id');

        $buckets = [
            '0_30' => ['count' => 0, 'amount' => 0.0],
            '31_60' => ['count' => 0, 'amount' => 0.0],
            '61_90' => ['count' => 0, 'amount' => 0.0],
            '90_plus' => ['count' => 0, 'amount' => 0.0],
        ];

        $items = [];
        foreach ($query->get() as $commitment) {
            $anchor = $commitment->reserved_at ?? $commitment->created_at ?? $asOf;
            $ageDays = (int) Carbon::parse($anchor)->startOfDay()->diffInDays($asOf->copy()->startOfDay());
            $bucket = match (true) {
                $ageDays <= 30 => '0_30',
                $ageDays <= 60 => '31_60',
                $ageDays <= 90 => '61_90',
                default => '90_plus',
            };

            $amount = round((float) $commitment->current_amount, 2);
            $buckets[$bucket]['count']++;
            $buckets[$bucket]['amount'] = round($buckets[$bucket]['amount'] + $amount, 2);

            $line = $commitment->budgetLine;
            $items[] = [
                'id' => $commitment->id,
                'budget_line_id' => $commitment->budget_line_id,
                'budget_line_code' => $line?->code,
                'budget_line_name' => $line?->displayName(),
                'department_id' => $line?->department_id,
                'funding_source_id' => $line?->funding_source_id,
                'source_type' => $commitment->source_type,
                'source_id' => $commitment->source_id,
                'source_key' => $commitment->source_key,
                'status' => $commitment->status,
                'amount' => $amount,
                'currency' => $commitment->currency,
                'reserved_at' => optional($commitment->reserved_at ?? $commitment->created_at)?->toIso8601String(),
                'age_days' => $ageDays,
                'age_bucket' => $bucket,
            ];
        }

        return [
            'as_of' => $asOf->toIso8601String(),
            'buckets' => $buckets,
            'items' => $items,
        ];
    }

    /**
     * @param  array{
     *   financial_year_id?:int|null,
     *   status?:string|null,
     *   type?:string|null,
     *   from?:string|null,
     *   to?:string|null
     * }  $filters
     * @return array{rows:list<array<string,mixed>>}
     */
    public function changeRegister(int $tenantId, array $filters = []): array
    {
        $rows = BudgetChangeRequest::query()
            ->with(['items', 'preparer', 'budget', 'financialYear'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['financial_year_id']), fn ($q) => $q->where('financial_year_id', (int) $filters['financial_year_id']))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['type']), fn ($q) => $q->where('type', $filters['type']))
            ->when(! empty($filters['from']), fn ($q) => $q->whereDate('created_at', '>=', $filters['from']))
            ->when(! empty($filters['to']), fn ($q) => $q->whereDate('created_at', '<=', $filters['to']))
            ->orderByDesc('id')
            ->get()
            ->map(function (BudgetChangeRequest $req) {
                $totalAmount = round($req->items->sum(fn ($item) => abs((float) $item->amount)), 2);

                return [
                    'id' => $req->id,
                    'title' => $req->title,
                    'type' => $req->type,
                    'status' => $req->status,
                    'budget_id' => $req->budget_id,
                    'budget_name' => $req->budget?->name,
                    'financial_year_id' => $req->financial_year_id,
                    'financial_year_code' => $req->financialYear?->code,
                    'requires_sg' => (bool) $req->requires_sg,
                    'total_amount' => $totalAmount,
                    'item_count' => $req->items->count(),
                    'prepared_by' => $req->preparer?->only(['id', 'name']),
                    'submitted_at' => optional($req->submitted_at)?->toIso8601String(),
                    'finance_decided_at' => optional($req->finance_decided_at)?->toIso8601String(),
                    'finance_decided_by' => $req->finance_decided_by,
                    'sg_decided_at' => optional($req->sg_decided_at)?->toIso8601String(),
                    'sg_decided_by' => $req->sg_decided_by,
                    'applied_at' => optional($req->applied_at)?->toIso8601String(),
                    'applied_by' => $req->applied_by,
                    'created_at' => optional($req->created_at)?->toIso8601String(),
                    'approver_path' => $this->changeApproverPath($req),
                ];
            })
            ->values()
            ->all();

        return ['rows' => $rows];
    }

    /**
     * @param  array{financial_year_id?:int|null}  $filters
     * @return array{rows:list<array<string,mixed>>}
     */
    public function cycleStatus(int $tenantId, array $filters = []): array
    {
        $cycles = BudgetCycle::query()
            ->with(['financialYear', 'guideline', 'openedBy', 'lockedBy'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['financial_year_id']), fn ($q) => $q->where('financial_year_id', (int) $filters['financial_year_id']))
            ->orderByDesc('id')
            ->get();

        $submissionCounts = BudgetSubmission::query()
            ->select('budget_cycle_id', 'status', DB::raw('count(*) as aggregate'))
            ->whereIn('budget_cycle_id', $cycles->pluck('id'))
            ->groupBy('budget_cycle_id', 'status')
            ->get()
            ->groupBy('budget_cycle_id');

        $rows = $cycles->map(function (BudgetCycle $cycle) use ($submissionCounts) {
            $counts = [];
            foreach ($submissionCounts->get($cycle->id, collect()) as $row) {
                $counts[$row->status] = (int) $row->aggregate;
            }

            $guideline = $cycle->guideline;

            return [
                'id' => $cycle->id,
                'financial_year_id' => $cycle->financial_year_id,
                'financial_year_code' => $cycle->financialYear?->code,
                'financial_year_label' => $cycle->financialYear?->label,
                'status' => $cycle->status,
                'opened_at' => optional($cycle->opened_at)?->toIso8601String(),
                'opened_by' => $cycle->openedBy?->only(['id', 'name']),
                'sg_approved_at' => optional($cycle->sg_approved_at)?->toIso8601String(),
                'locked_at' => optional($cycle->locked_at)?->toIso8601String(),
                'locked_by' => $cycle->lockedBy?->only(['id', 'name']),
                'approved_total' => $cycle->approved_total !== null ? (float) $cycle->approved_total : null,
                'notes' => $cycle->notes,
                'submission_opens_on' => optional($guideline?->submission_opens_on)?->toDateString(),
                'department_deadline' => optional($guideline?->department_deadline)?->toDateString(),
                'guidelines_published_at' => optional($guideline?->published_at)?->toIso8601String(),
                'submission_counts' => $counts,
                'submission_total' => array_sum($counts),
            ];
        })->values()->all();

        return ['rows' => $rows];
    }

    /**
     * @param  Collection<int,array<string,mixed>>  $lineRows
     * @return list<array<string,mixed>>
     */
    private function rollupUtilisation(Collection $lineRows, string $idKey, string $nameKey, ?string $codeKey = null): array
    {
        return $lineRows
            ->groupBy(fn (array $row) => $row[$idKey] ?? 0)
            ->map(function (Collection $group) use ($idKey, $nameKey, $codeKey) {
                $first = $group->first();
                $approved = round($group->sum('approved'), 2);
                $actual = round($group->sum('actual'), 2);
                $committed = round($group->sum('committed'), 2);
                $available = round($group->sum('available'), 2);
                $pct = $approved > 0 ? round((($approved - $available) / $approved) * 100, 2) : 0.0;

                $row = [
                    $idKey => $first[$idKey],
                    $nameKey => $first[$nameKey] ?? 'Unassigned',
                    'line_count' => $group->count(),
                    'approved' => $approved,
                    'actual' => $actual,
                    'committed' => $committed,
                    'available' => $available,
                    'pct_utilised' => $pct,
                ];
                if ($codeKey !== null) {
                    $row[$codeKey] = $first[$codeKey] ?? null;
                }

                return $row;
            })
            ->sortBy($nameKey)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int,array<string,mixed>>  $rows
     * @return array{approved:float,actual:float,committed:float,available:float,line_count:int}
     */
    private function sumMoneyColumns(Collection $rows): array
    {
        return [
            'approved' => round($rows->sum('approved'), 2),
            'actual' => round($rows->sum('actual'), 2),
            'committed' => round($rows->sum('committed'), 2),
            'available' => round($rows->sum('available'), 2),
            'line_count' => $rows->count(),
        ];
    }

    /**
     * @return list<array{step:string,at:?string,actor_id:?int,label:string}>
     */
    private function changeApproverPath(BudgetChangeRequest $req): array
    {
        $path = [
            [
                'step' => 'prepared',
                'label' => 'Prepared',
                'at' => optional($req->created_at)?->toIso8601String(),
                'actor_id' => $req->prepared_by,
            ],
        ];

        if ($req->submitted_at) {
            $path[] = [
                'step' => 'submitted',
                'label' => 'Submitted to Finance',
                'at' => $req->submitted_at->toIso8601String(),
                'actor_id' => $req->prepared_by,
            ];
        }

        if ($req->finance_decided_at) {
            $path[] = [
                'step' => 'finance',
                'label' => 'Finance decision',
                'at' => $req->finance_decided_at->toIso8601String(),
                'actor_id' => $req->finance_decided_by,
            ];
        }

        if ($req->sg_decided_at) {
            $path[] = [
                'step' => 'sg',
                'label' => 'SG decision',
                'at' => $req->sg_decided_at->toIso8601String(),
                'actor_id' => $req->sg_decided_by,
            ];
        }

        if ($req->applied_at) {
            $path[] = [
                'step' => 'applied',
                'label' => 'Applied to lines',
                'at' => $req->applied_at->toIso8601String(),
                'actor_id' => $req->applied_by,
            ];
        }

        if ($req->status === BudgetChangeRequest::STATUS_REJECTED) {
            $path[] = [
                'step' => 'rejected',
                'label' => 'Rejected',
                'at' => optional($req->sg_decided_at ?? $req->finance_decided_at)?->toIso8601String(),
                'actor_id' => $req->sg_decided_by ?? $req->finance_decided_by,
            ];
        }

        if ($req->status === BudgetChangeRequest::STATUS_RETURNED) {
            $path[] = [
                'step' => 'returned',
                'label' => 'Returned',
                'at' => optional($req->sg_decided_at ?? $req->finance_decided_at)?->toIso8601String(),
                'actor_id' => $req->sg_decided_by ?? $req->finance_decided_by,
            ];
        }

        return $path;
    }
}
