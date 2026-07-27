<?php

namespace App\Modules\Budget\Services;

use App\Models\BudgetCycle;
use App\Models\BudgetCycleApproval;
use App\Models\BudgetGuideline;
use App\Models\FinancialYear;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetCycleService
{
    public function __construct(
        private readonly BudgetActivationService $activation,
    ) {}

    public function listForTenant(int $tenantId)
    {
        return BudgetCycle::query()
            ->with(['financialYear', 'guideline'])
            ->where('tenant_id', $tenantId)
            ->orderByDesc('id')
            ->get();
    }

    public function open(int $tenantId, int $financialYearId, User $actor, ?string $notes = null): BudgetCycle
    {
        $this->assertFinance($actor);

        $fy = FinancialYear::query()
            ->where('tenant_id', $tenantId)
            ->whereKey($financialYearId)
            ->firstOrFail();

        $existing = BudgetCycle::query()
            ->where('tenant_id', $tenantId)
            ->where('financial_year_id', $fy->id)
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'financial_year_id' => 'A budget cycle already exists for this financial year.',
            ]);
        }

        return BudgetCycle::create([
            'tenant_id' => $tenantId,
            'financial_year_id' => $fy->id,
            'status' => BudgetCycle::STATUS_PLANNING,
            'opened_by' => $actor->id,
            'opened_at' => now(),
            'notes' => $notes,
        ]);
    }

    public function publishGuidelines(BudgetCycle $cycle, array $data, User $actor): BudgetGuideline
    {
        $this->assertFinance($actor);
        $this->assertTenant($cycle, $actor);

        if ($cycle->isLocked()) {
            throw ValidationException::withMessages(['cycle' => 'Cannot update guidelines on a locked cycle.']);
        }

        $guideline = BudgetGuideline::query()->updateOrCreate(
            ['budget_cycle_id' => $cycle->id],
            [
                'submission_opens_on' => $data['submission_opens_on'] ?? null,
                'department_deadline' => $data['department_deadline'] ?? null,
                'assumptions' => $data['assumptions'] ?? null,
                'inflation_rate' => $data['inflation_rate'] ?? null,
                'fx_assumptions' => $data['fx_assumptions'] ?? null,
                'ceilings' => $data['ceilings'] ?? null,
                'guidance_document_path' => $data['guidance_document_path'] ?? null,
                'published_by' => $actor->id,
                'published_at' => now(),
            ]
        );

        if ($cycle->status === BudgetCycle::STATUS_PLANNING) {
            $cycle->update(['status' => BudgetCycle::STATUS_DEPARTMENT_PREPARATION]);
        }

        return $guideline->fresh();
    }

    public function advance(BudgetCycle $cycle, User $actor, ?string $comments = null): BudgetCycle
    {
        $this->assertFinance($actor);
        $this->assertTenant($cycle, $actor);

        if ($cycle->isLocked()) {
            throw ValidationException::withMessages(['cycle' => 'Cycle is locked.']);
        }

        $next = BudgetCycle::ADVANCE_MAP[$cycle->status] ?? null;
        if (! $next) {
            throw ValidationException::withMessages([
                'status' => "Cannot advance from status [{$cycle->status}]. Use SG approve or lock.",
            ]);
        }

        if ($cycle->status === BudgetCycle::STATUS_DEPARTMENT_PREPARATION) {
            $openPacks = $cycle->submissions()
                ->whereIn('status', ['draft', 'pending_hod', 'returned'])
                ->count();
            if ($openPacks > 0) {
                throw ValidationException::withMessages([
                    'submissions' => 'All department packs must be submitted before advancing to Finance.',
                ]);
            }
        }

        return DB::transaction(function () use ($cycle, $actor, $comments, $next) {
            $from = $cycle->status;
            $cycle->update(['status' => $next]);

            BudgetCycleApproval::create([
                'budget_cycle_id' => $cycle->id,
                'stage' => $from,
                'decision' => 'approved',
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'comments' => $comments,
            ]);

            return $cycle->fresh(['financialYear', 'guideline', 'approvals']);
        });
    }

    public function returnToDepartments(BudgetCycle $cycle, User $actor, string $reason): BudgetCycle
    {
        $this->assertFinance($actor);
        $this->assertTenant($cycle, $actor);

        if ($cycle->status !== BudgetCycle::STATUS_FINANCE_REVIEW) {
            throw ValidationException::withMessages([
                'status' => 'Cycles can only be returned from finance_review.',
            ]);
        }

        return DB::transaction(function () use ($cycle, $actor, $reason) {
            $cycle->update(['status' => BudgetCycle::STATUS_DEPARTMENT_PREPARATION]);

            BudgetCycleApproval::create([
                'budget_cycle_id' => $cycle->id,
                'stage' => BudgetCycle::STATUS_FINANCE_REVIEW,
                'decision' => 'returned',
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'comments' => $reason,
            ]);

            $cycle->submissions()
                ->whereIn('status', ['submitted', 'accepted', 'consolidated'])
                ->update([
                    'status' => 'returned',
                    'returned_reason' => $reason,
                ]);

            return $cycle->fresh(['financialYear', 'guideline', 'approvals']);
        });
    }

    public function sgApprove(BudgetCycle $cycle, User $actor, ?string $comments = null, ?float $approvedTotal = null): BudgetCycle
    {
        $this->assertTenant($cycle, $actor);

        if (! $actor->hasRole('Secretary General') && ! $actor->can('finance.admin') && ! $actor->isSystemAdmin()) {
            abort(403);
        }

        if (! in_array($cycle->status, [
            BudgetCycle::STATUS_MANAGEMENT_REVIEW,
            BudgetCycle::STATUS_SG_APPROVED,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'SG approval requires management_review (or already sg_approved).',
            ]);
        }

        return DB::transaction(function () use ($cycle, $actor, $comments, $approvedTotal) {
            $total = $approvedTotal;
            if ($total === null) {
                $total = (float) $cycle->submissions()
                    ->whereIn('status', ['submitted', 'accepted', 'consolidated'])
                    ->withSum('items as items_total', 'requested_amount')
                    ->get()
                    ->sum('items_total');
            }

            $cycle->update([
                'status' => BudgetCycle::STATUS_SG_APPROVED,
                'sg_approved_by' => $actor->id,
                'sg_approved_at' => now(),
                'approved_total' => $total,
            ]);

            BudgetCycleApproval::create([
                'budget_cycle_id' => $cycle->id,
                'stage' => BudgetCycle::STATUS_SG_APPROVED,
                'decision' => 'approved',
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'comments' => $comments,
                'approved_total' => $total,
            ]);

            return $cycle->fresh(['financialYear', 'guideline', 'approvals']);
        });
    }

    public function lock(BudgetCycle $cycle, User $actor): BudgetCycle
    {
        $this->assertFinanceController($actor);
        $this->assertTenant($cycle, $actor);

        if ($cycle->status !== BudgetCycle::STATUS_SG_APPROVED) {
            throw ValidationException::withMessages([
                'status' => 'Lock requires SG-approved status.',
            ]);
        }

        return $this->activation->activate($cycle, $actor);
    }

    private function assertFinance(User $actor): void
    {
        if (
            ! $actor->can('finance.create')
            && ! $actor->can('finance.admin')
            && ! $actor->hasRole('Finance Controller')
            && ! $actor->isSystemAdmin()
        ) {
            abort(403);
        }
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

    private function assertTenant(BudgetCycle $cycle, User $actor): void
    {
        if ((int) $cycle->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
