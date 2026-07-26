<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\BudgetReservation;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class TravelBudgetReservationService
{
    public function reserveOnApprove(TravelRequest $travel, User $actor): ?BudgetReservation
    {
        $existing = BudgetReservation::query()
            ->where('travel_request_id', $travel->id)
            ->whereNull('released_at')
            ->first();
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
            $amount = 1; // commitment placeholder when costs not yet quantified
        }

        $budgetLine = $travel->fundingLines
            ->first(fn ($l) => filled($l->budget_line))
            ?->budget_line
            ?? ($travel->budget_line_id ? (string) $travel->budget_line_id : 'TRAVEL-UNALLOCATED');

        $reservation = BudgetReservation::create([
            'tenant_id' => $travel->tenant_id,
            'procurement_request_id' => null,
            'travel_request_id' => $travel->id,
            'reserved_by' => $actor->id,
            'budget_line' => $budgetLine,
            'reserved_amount' => $amount,
            'currency' => $travel->currency ?? 'NAD',
            'notes' => 'Travel commitment on SG approval — '.$travel->reference_number,
        ]);

        AuditLog::record('travel.budget_reserved', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => [
                'reservation_id' => $reservation->id,
                'budget_line' => $budgetLine,
                'reserved_amount' => $amount,
            ],
            'tags' => 'travel,budget',
        ]);

        return $reservation;
    }

    public function releaseOnCancel(TravelRequest $travel, User $actor): ?BudgetReservation
    {
        $reservation = BudgetReservation::query()
            ->where('travel_request_id', $travel->id)
            ->whereNull('released_at')
            ->latest('id')
            ->first();

        if (! $reservation) {
            return null;
        }

        if ($reservation->isReleased()) {
            throw ValidationException::withMessages([
                'budget' => 'Budget reservation already released.',
            ]);
        }

        $reservation->update([
            'released_at' => now(),
            'released_by' => $actor->id,
        ]);

        AuditLog::record('travel.budget_released', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => ['reservation_id' => $reservation->id],
            'tags' => 'travel,budget',
        ]);

        return $reservation->fresh();
    }
}
