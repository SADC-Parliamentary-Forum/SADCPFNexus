<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetChangeRequest;
use App\Models\BudgetLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetChangeApplyService
{
    public function __construct(
        private readonly BudgetAvailabilityService $availability,
    ) {}

    public function apply(BudgetChangeRequest $request, User $actor): BudgetChangeRequest
    {
        $this->assertFinanceController($actor);

        if ((int) $request->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        if ($request->status !== BudgetChangeRequest::STATUS_APPROVED) {
            throw ValidationException::withMessages([
                'status' => 'Only approved change requests can be applied.',
            ]);
        }

        if ($request->applied_at) {
            throw ValidationException::withMessages(['request' => 'Already applied.']);
        }

        return DB::transaction(function () use ($request, $actor) {
            $request->load(['items', 'budget']);
            $budget = $request->budget;
            if (! $budget || $budget->status !== 'active') {
                throw ValidationException::withMessages(['budget' => 'Active budget required.']);
            }

            // Lock all touched lines
            $lineIds = $request->items->flatMap(fn ($i) => array_filter([
                $i->source_budget_line_id,
                $i->target_budget_line_id,
            ]))->unique()->values();

            $lines = BudgetLine::query()
                ->whereIn('id', $lineIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            match ($request->type) {
                BudgetChangeRequest::TYPE_TRANSFER,
                BudgetChangeRequest::TYPE_CONTINGENCY => $this->applyMoves($request, $lines),
                BudgetChangeRequest::TYPE_REVISION => $this->applyRevisions($request, $lines),
                BudgetChangeRequest::TYPE_SUPPLEMENTARY => $this->applySupplementary($request, $lines, $budget->id),
                default => throw ValidationException::withMessages(['type' => 'Unknown change type.']),
            };

            // Refresh budget total
            $total = (float) BudgetLine::query()
                ->where('budget_id', $budget->id)
                ->where('is_active', true)
                ->get()
                ->sum(fn (BudgetLine $l) => $l->currentApprovedAllocation());
            $budget->update(['total_amount' => $total]);

            $request->update([
                'status' => BudgetChangeRequest::STATUS_APPLIED,
                'applied_by' => $actor->id,
                'applied_at' => now(),
            ]);

            return $request->fresh(['items', 'budget', 'preparer']);
        });
    }

    private function applyMoves(BudgetChangeRequest $request, $lines): void
    {
        foreach ($request->items as $item) {
            $source = $lines->get($item->source_budget_line_id);
            $target = $lines->get($item->target_budget_line_id);
            if (! $source || ! $target) {
                throw ValidationException::withMessages(['items' => 'Missing source/target line.']);
            }

            if ($request->type === BudgetChangeRequest::TYPE_CONTINGENCY && ! $source->is_contingency) {
                throw ValidationException::withMessages([
                    'items' => 'Contingency source must be flagged is_contingency.',
                ]);
            }

            $amount = abs((float) $item->amount);
            $this->assertCanReduce($source, $amount);

            $this->setRevised($source, $source->currentApprovedAllocation() - $amount);
            $this->setRevised($target, $target->currentApprovedAllocation() + $amount);

            // Re-check availability after each move (source especially)
            $check = $this->availability->check($source->id, null, false);
            if ($check['available'] < -1e-6) {
                throw ValidationException::withMessages([
                    'items' => "Insufficient available on source line {$source->code}.",
                ]);
            }
        }
    }

    private function applyRevisions(BudgetChangeRequest $request, $lines): void
    {
        foreach ($request->items as $item) {
            $line = $lines->get($item->target_budget_line_id);
            if (! $line) {
                throw ValidationException::withMessages(['items' => 'Missing revision target line.']);
            }

            $delta = $item->signedAmount();
            $newApproved = $line->currentApprovedAllocation() + $delta;
            if ($newApproved < 0) {
                throw ValidationException::withMessages(['items' => 'Revision would make allocation negative.']);
            }

            if ($delta < 0) {
                $this->assertCanReduce($line, abs($delta));
            }

            $this->setRevised($line, $newApproved);

            $check = $this->availability->check($line->id);
            if ($check['available'] < -1e-6) {
                throw ValidationException::withMessages([
                    'items' => "Revision leaves line {$line->code} overcommitted.",
                ]);
            }
        }
    }

    private function applySupplementary(BudgetChangeRequest $request, $lines, int $budgetId): void
    {
        foreach ($request->items as $item) {
            $amount = abs((float) $item->amount);

            if ($item->target_budget_line_id) {
                $line = $lines->get($item->target_budget_line_id) ?? BudgetLine::query()->lockForUpdate()->find($item->target_budget_line_id);
                if (! $line) {
                    throw ValidationException::withMessages(['items' => 'Missing supplementary target.']);
                }
                $this->setRevised($line, $line->currentApprovedAllocation() + $amount);
            } else {
                $code = $item->new_line_code ?: ('SUP-'.$request->id.'-'.$item->id);
                $existing = BudgetLine::query()
                    ->where('budget_id', $budgetId)
                    ->where('code', $code)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    $this->setRevised($existing, $existing->currentApprovedAllocation() + $amount);
                } else {
                    BudgetLine::create([
                        'budget_id' => $budgetId,
                        'code' => $code,
                        'name' => $item->new_line_name,
                        'category' => $item->new_line_category ?? 'operational',
                        'funding_source_id' => $item->new_line_funding_source_id,
                        'amount_allocated' => $amount,
                        'original_allocation' => $amount,
                        'revised_allocation' => null,
                        'amount_spent' => 0,
                        'is_active' => true,
                        'is_contingency' => false,
                    ]);
                }
            }
        }
    }

    private function assertCanReduce(BudgetLine $line, float $amount): void
    {
        $check = $this->availability->check($line->id, $amount);
        if (! $check['sufficient']) {
            throw ValidationException::withMessages([
                'items' => "Insufficient available on line {$line->displayName()} to reduce by {$amount}.",
            ]);
        }
    }

    private function setRevised(BudgetLine $line, float $newApproved): void
    {
        $line->update([
            'revised_allocation' => round($newApproved, 2),
            'amount_allocated' => round($newApproved, 2),
        ]);
        $line->refresh();
    }

    private function assertFinanceController(User $actor): void
    {
        if (
            ! $actor->can('finance.admin')
            && ! $actor->hasRole('Finance Controller')
            && ! $actor->isSystemAdmin()
        ) {
            abort(403);
        }
    }
}
