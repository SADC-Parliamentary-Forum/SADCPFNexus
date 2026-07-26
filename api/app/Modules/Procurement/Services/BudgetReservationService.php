<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\ProcurementRequest;
use App\Models\User;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class BudgetReservationService
{
    public function __construct(
        private readonly BudgetCommitmentService $commitments,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        return BudgetReservation::with(['procurementRequest', 'reservedBy', 'budgetLine'])
            ->where('tenant_id', $user->tenant_id)
            ->whereNotNull('procurement_request_id')
            ->orderByDesc('created_at')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function reserve(ProcurementRequest $request, array $data, User $user): BudgetReservation
    {
        if ((int) $request->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if (! $request->isHodApproved()) {
            throw ValidationException::withMessages([
                'status' => 'Budget can only be reserved for HOD-approved requests.',
            ]);
        }

        if ($data['reserved_amount'] > $request->estimated_value) {
            throw ValidationException::withMessages([
                'reserved_amount' => 'Reserved amount cannot exceed the estimated value of '.number_format($request->estimated_value, 2),
            ]);
        }

        $lineId = $data['budget_line_id'] ?? null;
        if (! $lineId && ! empty($data['budget_line'])) {
            $lineId = BudgetLine::query()
                ->where('code', $data['budget_line'])
                ->whereHas('budget', fn ($q) => $q->where('tenant_id', $user->tenant_id))
                ->value('id');
        }

        if (! $lineId) {
            throw ValidationException::withMessages([
                'budget_line_id' => 'A valid institutional budget line is required.',
            ]);
        }

        $sourceKey = 'PROCUREMENT:'.$request->id;
        $parent = null;
        if ($request->programme_id) {
            $parent = $this->commitments->findBySourceKey((int) $user->tenant_id, 'PIF:'.$request->programme_id);
        }

        if ($parent && $parent->isActive()) {
            $reservation = $this->commitments->transfer($parent, [
                'source_type' => 'procurement',
                'source_id' => $request->id,
                'source_key' => $sourceKey,
                'amount' => (float) $data['reserved_amount'],
                'budget_line_id' => (int) $lineId,
                'currency' => $data['currency'] ?? $request->currency ?? 'NAD',
                'notes' => $data['notes'] ?? null,
                'procurement_request_id' => $request->id,
                'programme_id' => $request->programme_id,
                'idempotency_key' => 'proc-reserve-'.$request->id,
            ], $user);
        } else {
            $reservation = $this->commitments->reserve([
                'tenant_id' => $user->tenant_id,
                'budget_line_id' => (int) $lineId,
                'amount' => (float) $data['reserved_amount'],
                'source_type' => 'procurement',
                'source_id' => $request->id,
                'source_key' => $sourceKey,
                'currency' => $data['currency'] ?? $request->currency ?? 'NAD',
                'notes' => $data['notes'] ?? null,
                'procurement_request_id' => $request->id,
                'programme_id' => $request->programme_id,
                'idempotency_key' => 'proc-reserve-'.$request->id,
                'confirm' => true,
            ], $user);
        }

        $request->update([
            'status' => 'budget_reserved',
            'budget_line' => $reservation->budget_line,
        ]);

        AuditLog::record('procurement.budget_reserved', [
            'auditable_type' => ProcurementRequest::class,
            'auditable_id' => $request->id,
            'new_values' => [
                'budget_line_id' => $reservation->budget_line_id,
                'budget_line' => $reservation->budget_line,
                'reserved_amount' => $reservation->current_amount,
                'commitment_id' => $reservation->id,
            ],
            'tags' => 'procurement,budget',
        ]);

        return $reservation->load(['procurementRequest', 'reservedBy', 'budgetLine']);
    }

    public function release(BudgetReservation $reservation, User $user): BudgetReservation
    {
        if ((int) $reservation->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        return $this->commitments->release($reservation, $user, 'Procurement budget released');
    }
}
