<?php

namespace App\Modules\Budget\Services;

use App\Models\Budget;
use App\Models\BudgetCycle;
use App\Models\BudgetCycleApproval;
use App\Models\BudgetLine;
use App\Models\BudgetSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BudgetActivationService
{
    public function activate(BudgetCycle $cycle, User $actor): BudgetCycle
    {
        if ($cycle->status !== BudgetCycle::STATUS_SG_APPROVED) {
            throw ValidationException::withMessages([
                'status' => 'Only SG-approved cycles can be locked and activated.',
            ]);
        }

        if ($cycle->isLocked() && $cycle->status === BudgetCycle::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'cycle' => 'Cycle is already active.',
            ]);
        }

        return DB::transaction(function () use ($cycle, $actor) {
            $cycle->loadMissing('financialYear');

            $packs = $cycle->submissions()
                ->whereIn('status', [
                    BudgetSubmission::STATUS_SUBMITTED,
                    BudgetSubmission::STATUS_ACCEPTED,
                    BudgetSubmission::STATUS_CONSOLIDATED,
                ])
                ->with('items')
                ->get();

            if ($packs->isEmpty()) {
                throw ValidationException::withMessages([
                    'submissions' => 'No accepted/submitted packs to materialise.',
                ]);
            }

            $fy = $cycle->financialYear;
            $budget = Budget::query()->firstOrCreate(
                [
                    'tenant_id' => $cycle->tenant_id,
                    'financial_year_id' => $fy->id,
                    'name' => "FY {$fy->code} Institutional Budget",
                ],
                [
                    'year' => (string) $fy->starts_on->year,
                    'type' => 'core',
                    'status' => 'draft',
                    'currency' => 'NAD',
                    'total_amount' => 0,
                    'created_by' => $actor->id,
                    'description' => 'Activated from budget cycle #'.$cycle->id,
                ]
            );

            $total = 0.0;
            foreach ($packs as $pack) {
                foreach ($pack->items as $item) {
                    $code = $item->code ?: $this->generateCode($pack, $item->name, $item->id);
                    $line = BudgetLine::query()
                        ->where('budget_id', $budget->id)
                        ->where('code', $code)
                        ->first();

                    $amount = (float) $item->requested_amount;
                    $total += $amount;

                    if ($line) {
                        $line->update([
                            'name' => $item->name,
                            'category' => $item->category ?? $line->category,
                            'description' => $item->description ?? $line->description,
                            'funding_source_id' => $item->funding_source_id ?? $line->funding_source_id,
                            'department_id' => $pack->department_id ?? $line->department_id,
                            'programme_id' => $pack->programme_id ?? $line->programme_id,
                            'amount_allocated' => $amount,
                            'original_allocation' => $amount,
                            'revised_allocation' => null,
                            'is_active' => true,
                        ]);
                    } else {
                        BudgetLine::create([
                            'budget_id' => $budget->id,
                            'code' => $code,
                            'name' => $item->name,
                            'category' => $item->category ?? 'operational',
                            'description' => $item->description,
                            'funding_source_id' => $item->funding_source_id,
                            'department_id' => $pack->department_id,
                            'programme_id' => $pack->programme_id,
                            'amount_allocated' => $amount,
                            'original_allocation' => $amount,
                            'amount_spent' => 0,
                            'is_active' => true,
                        ]);
                    }
                }

                if ($pack->status !== BudgetSubmission::STATUS_CONSOLIDATED) {
                    $pack->update(['status' => BudgetSubmission::STATUS_CONSOLIDATED]);
                }
            }

            $budget->update([
                'status' => 'active',
                'total_amount' => $total,
                'financial_year_id' => $fy->id,
            ]);

            $cycle->update([
                'status' => BudgetCycle::STATUS_ACTIVE,
                'locked_by' => $actor->id,
                'locked_at' => now(),
                'approved_total' => $cycle->approved_total ?? $total,
            ]);

            BudgetCycleApproval::create([
                'budget_cycle_id' => $cycle->id,
                'stage' => BudgetCycle::STATUS_ACTIVE,
                'decision' => 'approved',
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'comments' => 'Locked and activated institutional budget lines',
                'approved_total' => $total,
            ]);

            return $cycle->fresh(['financialYear', 'guideline', 'approvals', 'submissions.items']);
        });
    }

    private function generateCode(BudgetSubmission $pack, string $name, int $itemId): string
    {
        $prefix = match ($pack->type) {
            'programme' => 'PROG',
            'capital' => 'CAP',
            'revenue' => 'REV',
            default => 'DEPT',
        };
        $slug = Str::upper(Str::substr(Str::slug($name, ''), 0, 8)) ?: 'LINE';

        return sprintf('%s-%s-%d', $prefix, $slug, $itemId);
    }
}
