<?php

namespace App\Modules\Imprest\Services;

use App\Models\AuditLog;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\ImprestRequest;
use App\Models\User;
use App\Modules\Budget\Services\BudgetActualService;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Illuminate\Validation\ValidationException;

class ImprestBudgetReservationService
{
    public function __construct(
        private readonly BudgetCommitmentService $commitments,
        private readonly BudgetActualService $actuals,
    ) {}

    public function reserveOnApprove(ImprestRequest $imprest, User $actor): ?BudgetReservation
    {
        $existing = $this->commitments->findBySourceKey((int) $imprest->tenant_id, 'IMPREST:'.$imprest->id);
        if ($existing && $existing->isActive()) {
            return $existing;
        }

        $budgetLineId = $this->resolveBudgetLineId($imprest);
        if (! $budgetLineId) {
            // Legacy imprest without institutional line — skip controlled commitment.
            return null;
        }

        $amount = (float) ($imprest->amount_approved ?? $imprest->amount_requested ?? 0);
        if ($amount <= 0) {
            return null;
        }

        $parent = null;
        if ($imprest->travel_request_id) {
            $parent = $this->commitments->findBySourceKey(
                (int) $imprest->tenant_id,
                'TRAVEL:'.$imprest->travel_request_id
            );
        }

        if ($parent && $parent->isActive()) {
            $reservation = $this->commitments->transfer($parent, [
                'source_type' => 'imprest',
                'source_id' => $imprest->id,
                'source_key' => 'IMPREST:'.$imprest->id,
                'amount' => $amount,
                'budget_line_id' => $budgetLineId,
                'currency' => $imprest->currency ?? 'NAD',
                'notes' => 'Imprest commitment on approval — '.$imprest->reference_number,
                'travel_request_id' => $imprest->travel_request_id,
                'idempotency_key' => 'imprest-reserve-'.$imprest->id,
            ], $actor);
        } else {
            $reservation = $this->commitments->reserve([
                'tenant_id' => $imprest->tenant_id,
                'budget_line_id' => $budgetLineId,
                'amount' => $amount,
                'source_type' => 'imprest',
                'source_id' => $imprest->id,
                'source_key' => 'IMPREST:'.$imprest->id,
                'currency' => $imprest->currency ?? 'NAD',
                'notes' => 'Imprest commitment on approval — '.$imprest->reference_number,
                'travel_request_id' => $imprest->travel_request_id,
                'idempotency_key' => 'imprest-reserve-'.$imprest->id,
                'confirm' => true,
            ], $actor);
        }

        AuditLog::record('imprest.budget_reserved', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'new_values' => [
                'reservation_id' => $reservation->id,
                'budget_line_id' => $reservation->budget_line_id,
                'reserved_amount' => $reservation->current_amount,
            ],
            'tags' => 'imprest,budget',
        ]);

        return $reservation;
    }

    public function releaseOnCancel(ImprestRequest $imprest, User $actor, string $reason = 'Imprest cancelled'): ?BudgetReservation
    {
        $reservation = $this->commitments->findBySourceKey((int) $imprest->tenant_id, 'IMPREST:'.$imprest->id);
        if (! $reservation || $reservation->isReleased()) {
            return null;
        }

        $released = $this->commitments->release($reservation, $actor, $reason);

        AuditLog::record('imprest.budget_released', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'new_values' => ['reservation_id' => $released->id, 'reason' => $reason],
            'tags' => 'imprest,budget',
        ]);

        return $released;
    }

    public function settleOnRetire(ImprestRequest $imprest, User $actor): ?BudgetReservation
    {
        $reservation = $this->commitments->findBySourceKey((int) $imprest->tenant_id, 'IMPREST:'.$imprest->id);
        if (! $reservation || $reservation->isReleased()) {
            return null;
        }

        $liquidated = round((float) ($imprest->amount_liquidated ?? 0), 2);
        $current = round((float) $reservation->current_amount, 2);

        if ($liquidated < 0) {
            throw ValidationException::withMessages([
                'amount_liquidated' => 'Liquidated amount cannot be negative.',
            ]);
        }

        if ($liquidated > $current + 1e-9) {
            throw ValidationException::withMessages([
                'amount_liquidated' => 'Cannot liquidate more than the committed amount.',
            ]);
        }

        // Release unused remainder by adjusting commitment down to liquidated amount.
        if ($liquidated + 1e-9 < $current) {
            if ($liquidated <= 0) {
                return $this->releaseOnCancel($imprest, $actor, 'Imprest liquidated with zero spend');
            }
            $reservation = $this->commitments->adjust(
                $reservation,
                $liquidated,
                $actor,
                'Release unused imprest commitment on retirement'
            );
        }

        // Consume liquidated amount (closes commitment) and post actual so availability stays correct.
        if ($liquidated > 0) {
            $reservation = $this->commitments->consume(
                $reservation,
                $liquidated,
                $actor,
                'Imprest liquidation '.$imprest->reference_number
            );

            $lineId = $reservation->budget_line_id ?? $this->resolveBudgetLineId($imprest);
            if ($lineId) {
                $this->actuals->post([
                    'tenant_id' => (int) $imprest->tenant_id,
                    'budget_line_id' => (int) $lineId,
                    'accounting_reference' => 'IMPREST:'.$imprest->id,
                    'transaction_date' => now()->toDateString(),
                    'amount' => $liquidated,
                    'currency' => $imprest->currency ?? 'NAD',
                    'description' => 'Imprest liquidation '.$imprest->reference_number,
                    'source_module' => 'imprest',
                    'source_id' => $imprest->id,
                ], $actor);
            }
        }

        AuditLog::record('imprest.budget_settled', [
            'auditable_type' => ImprestRequest::class,
            'auditable_id' => $imprest->id,
            'new_values' => [
                'reservation_id' => $reservation->id,
                'amount_liquidated' => $liquidated,
            ],
            'tags' => 'imprest,budget',
        ]);

        return $reservation->fresh();
    }

    private function resolveBudgetLineId(ImprestRequest $imprest): ?int
    {
        if ($imprest->budget_line_id) {
            $org = BudgetLine::query()->find($imprest->budget_line_id);
            if ($org) {
                return (int) $org->id;
            }
        }

        if (filled($imprest->budget_line)) {
            $byCode = BudgetLine::query()
                ->where('code', $imprest->budget_line)
                ->whereHas('budget', fn ($q) => $q->where('tenant_id', $imprest->tenant_id))
                ->value('id');
            if ($byCode) {
                return (int) $byCode;
            }
        }

        return null;
    }
}
