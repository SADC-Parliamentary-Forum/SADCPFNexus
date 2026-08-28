<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\TravelRequest;
use App\Models\User;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Illuminate\Validation\ValidationException;

class TravelBudgetReservationService
{
    public function __construct(
        private readonly BudgetCommitmentService $commitments,
    ) {}

    public function reserveOnApprove(TravelRequest $travel, User $actor): ?BudgetReservation
    {
        $existing = $this->commitments->findBySourceKey((int) $travel->tenant_id, 'TRAVEL:'.$travel->id);
        if ($existing) {
            return $existing;
        }

        $travel->loadMissing('fundingLines');
        $amount = (float) ($travel->finance_dsa_total ?? $travel->estimated_dsa ?? 0);
        foreach ($travel->fundingLines as $line) {
            $amount += (float) ($line->forum_amount ?? 0);
            $amount += (float) ($line->donor_amount ?? 0);
        }
        if ($amount <= 0) {
            $amount = 1;
        }

        $budgetLineId = $this->resolveBudgetLineId($travel);
        if (! $budgetLineId) {
            return $this->legacyReserve($travel, $actor, $amount);
        }

        $parent = null;
        if ($travel->programme_id) {
            $parent = $this->commitments->findBySourceKey((int) $travel->tenant_id, 'PIF:'.$travel->programme_id);
        }

        if ($parent && $parent->isActive()) {
            $reservation = $this->commitments->transfer($parent, [
                'source_type' => 'travel',
                'source_id' => $travel->id,
                'source_key' => 'TRAVEL:'.$travel->id,
                'amount' => $amount,
                'budget_line_id' => $budgetLineId,
                'currency' => $travel->currency ?? 'NAD',
                'notes' => 'Travel commitment on approval — '.$travel->reference_number,
                'travel_request_id' => $travel->id,
                'programme_id' => $travel->programme_id,
                'idempotency_key' => 'travel-reserve-'.$travel->id,
            ], $actor);
        } else {
            $reservation = $this->commitments->reserve([
                'tenant_id' => $travel->tenant_id,
                'budget_line_id' => $budgetLineId,
                'amount' => $amount,
                'source_type' => 'travel',
                'source_id' => $travel->id,
                'source_key' => 'TRAVEL:'.$travel->id,
                'currency' => $travel->currency ?? 'NAD',
                'notes' => 'Travel commitment on approval — '.$travel->reference_number,
                'travel_request_id' => $travel->id,
                'programme_id' => $travel->programme_id,
                'idempotency_key' => 'travel-reserve-'.$travel->id,
                'confirm' => true,
            ], $actor);
        }

        AuditLog::record('travel.budget_reserved', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => [
                'reservation_id' => $reservation->id,
                'budget_line_id' => $reservation->budget_line_id,
                'reserved_amount' => $reservation->current_amount,
            ],
            'tags' => 'travel,budget',
        ]);

        return $reservation;
    }

    public function releaseOnCancel(TravelRequest $travel, User $actor): ?BudgetReservation
    {
        $reservation = $this->commitments->findBySourceKey((int) $travel->tenant_id, 'TRAVEL:'.$travel->id);
        if (! $reservation) {
            $reservation = BudgetReservation::query()
                ->where('travel_request_id', $travel->id)
                ->whereNull('released_at')
                ->latest('id')
                ->first();
        }

        if (! $reservation) {
            return null;
        }

        if ($reservation->isReleased()) {
            throw ValidationException::withMessages([
                'budget' => 'Budget reservation already released.',
            ]);
        }

        $released = $this->commitments->release($reservation, $actor, 'Travel cancelled');

        AuditLog::record('travel.budget_released', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => ['reservation_id' => $released->id],
            'tags' => 'travel,budget',
        ]);

        return $released;
    }

    private function resolveBudgetLineId(TravelRequest $travel): ?int
    {
        if ($travel->budget_line_id) {
            $org = BudgetLine::query()->find($travel->budget_line_id);
            if ($org) {
                return (int) $org->id;
            }
        }

        $code = $travel->fundingLines
            ->first(fn ($l) => filled($l->budget_line))
            ?->budget_line;

        if ($code) {
            $byCode = BudgetLine::query()
                ->where('code', $code)
                ->whereHas('budget', fn ($q) => $q->where('tenant_id', $travel->tenant_id))
                ->value('id');
            if ($byCode) {
                return (int) $byCode;
            }
        }

        return null;
    }

    /**
     * Encumber travel against a free-text funding code when no BudgetLine row exists.
     * Cancel still releases this row; GL posting stays gated on budget_line_id.
     */
    private function legacyReserve(TravelRequest $travel, User $actor, float $amount): BudgetReservation
    {
        $code = $travel->fundingLines
            ->first(fn ($l) => filled($l->budget_line))
            ?->budget_line
            ?? 'TRAVEL-UNALLOCATED';

        $existing = BudgetReservation::query()
            ->where('tenant_id', $travel->tenant_id)
            ->where('source_key', 'TRAVEL:'.$travel->id)
            ->first();
        if ($existing) {
            return $existing;
        }

        $now = now();

        return BudgetReservation::create([
            'tenant_id' => $travel->tenant_id,
            'travel_request_id' => $travel->id,
            'reserved_by' => $actor->id,
            'budget_line' => $code,
            'source_type' => 'travel',
            'source_id' => $travel->id,
            'source_key' => 'TRAVEL:'.$travel->id,
            'idempotency_key' => 'travel-reserve-'.$travel->id,
            'reserved_amount' => $amount,
            'original_amount' => $amount,
            'current_amount' => $amount,
            'currency' => $travel->currency ?? 'NAD',
            'notes' => 'Travel commitment on approval (legacy line) — '.$travel->reference_number,
            'status' => 'confirmed',
            'reserved_at' => $now,
            'confirmed_at' => $now,
        ]);
    }
}
