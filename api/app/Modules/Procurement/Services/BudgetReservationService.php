<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\BudgetReservation;
use App\Models\ProcurementRequest;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class BudgetReservationService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        return BudgetReservation::with(['procurementRequest', 'reservedBy'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function reserve(ProcurementRequest $request, array $data, User $user): BudgetReservation
    {
        if ((int) $request->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if (!$request->isHodApproved()) {
            throw ValidationException::withMessages([
                'status' => 'Budget can only be reserved for HOD-approved requests.',
            ]);
        }

        // Validate reserved amount does not exceed estimated value
        if ($data['reserved_amount'] > $request->estimated_value) {
            throw ValidationException::withMessages([
                'reserved_amount' => 'Reserved amount cannot exceed the estimated value of ' . number_format($request->estimated_value, 2),
            ]);
        }

        $reservation = BudgetReservation::create([
            'tenant_id'               => $user->tenant_id,
            'procurement_request_id'  => $request->id,
            'reserved_by'             => $user->id,
            'budget_line'             => $data['budget_line'],
            'reserved_amount'         => $data['reserved_amount'],
            'currency'                => $data['currency'] ?? $request->currency ?? 'NAD',
            'notes'                   => $data['notes'] ?? null,
        ]);

        // Advance request status to budget_reserved
        $request->update(['status' => 'budget_reserved']);

        AuditLog::record('procurement.budget_reserved', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id'   => $request->id,
            'new_values'     => [
                'budget_line'     => $data['budget_line'],
                'reserved_amount' => $data['reserved_amount'],
            ],
            'tags' => 'procurement',
        ]);

        return $reservation->load(['procurementRequest', 'reservedBy']);
    }

    public function release(BudgetReservation $reservation, User $user): BudgetReservation
    {
        if ((int) $reservation->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if ($reservation->isReleased()) {
            throw ValidationException::withMessages([
                'status' => 'This budget reservation has already been released.',
            ]);
        }

        $reservation->update([
            'released_at' => now(),
            'released_by' => $user->id,
        ]);

        AuditLog::record('procurement.budget_released', [
            'auditable_type' => BudgetReservation::class,
            'auditable_id'   => $reservation->id,
            'tags'           => 'procurement',
        ]);

        return $reservation->fresh();
    }
}
