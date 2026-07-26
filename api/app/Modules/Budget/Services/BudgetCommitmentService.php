<?php

namespace App\Modules\Budget\Services;

use App\Models\AuditLog;
use App\Models\BudgetCommitmentTransaction;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BudgetCommitmentService
{
    public function __construct(
        private readonly BudgetAvailabilityService $availability,
    ) {}

    public function findBySourceKey(int $tenantId, string $sourceKey): ?BudgetReservation
    {
        return BudgetReservation::query()
            ->where('tenant_id', $tenantId)
            ->where('source_key', $sourceKey)
            ->whereNull('released_at')
            ->latest('id')
            ->first();
    }

    /**
     * @param  array{
     *   tenant_id:int,
     *   budget_line_id:int,
     *   amount:float|int|string,
     *   source_type:string,
     *   source_id:int,
     *   source_key:string,
     *   currency?:string,
     *   notes?:?string,
     *   idempotency_key?:?string,
     *   programme_id?:?int,
     *   procurement_request_id?:?int,
     *   travel_request_id?:?int,
     *   parent_commitment_id?:?int,
     *   commitment_chain_id?:?string,
     *   status?:string,
     *   confirm?:bool,
     *   allow_insufficient?:bool
     * }  $data
     */
    public function reserve(array $data, User $actor): BudgetReservation
    {
        return DB::transaction(function () use ($data, $actor) {
            if (! empty($data['idempotency_key'])) {
                $existing = BudgetReservation::query()
                    ->where('tenant_id', $data['tenant_id'])
                    ->where('idempotency_key', $data['idempotency_key'])
                    ->first();
                if ($existing) {
                    return $existing;
                }
            }

            $byKey = $this->findBySourceKey((int) $data['tenant_id'], $data['source_key']);
            if ($byKey) {
                return $byKey;
            }

            $amount = round((float) $data['amount'], 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Commitment amount must be greater than zero.',
                ]);
            }

            $line = BudgetLine::query()->whereKey($data['budget_line_id'])->lockForUpdate()->firstOrFail();
            if (! $line->is_active) {
                throw ValidationException::withMessages([
                    'budget_line_id' => 'Budget line is not active.',
                ]);
            }

            $check = $this->availability->check($line->id, $amount, lock: true);
            if (! ($data['allow_insufficient'] ?? false) && ! $check['sufficient']) {
                throw ValidationException::withMessages([
                    'amount' => 'Insufficient available budget. Available: '.number_format($check['available'], 2),
                ]);
            }

            $status = $data['status'] ?? (($data['confirm'] ?? true) ? 'confirmed' : 'reserved');
            $now = now();
            $label = $line->displayName();

            $commitment = BudgetReservation::create([
                'tenant_id' => $data['tenant_id'],
                'commitment_chain_id' => $data['commitment_chain_id'] ?? (string) Str::uuid(),
                'parent_commitment_id' => $data['parent_commitment_id'] ?? null,
                'procurement_request_id' => $data['procurement_request_id'] ?? null,
                'travel_request_id' => $data['travel_request_id'] ?? null,
                'programme_id' => $data['programme_id'] ?? null,
                'reserved_by' => $actor->id,
                'budget_line' => $label,
                'budget_line_id' => $line->id,
                'source_type' => $data['source_type'],
                'source_id' => $data['source_id'],
                'source_key' => $data['source_key'],
                'idempotency_key' => $data['idempotency_key'] ?? null,
                'reserved_amount' => $amount,
                'original_amount' => $amount,
                'current_amount' => $amount,
                'currency' => $data['currency'] ?? 'NAD',
                'notes' => $data['notes'] ?? null,
                'status' => $status,
                'reserved_at' => $now,
                'confirmed_at' => $status === 'confirmed' ? $now : null,
            ]);

            $this->recordTransaction($commitment, 'reserve', $amount, $actor, $data['notes'] ?? null);
            if ($status === 'confirmed') {
                $this->recordTransaction($commitment, 'confirm', $amount, $actor, 'Confirmed on reserve');
            }

            AuditLog::record('budget.commitment_reserved', [
                'auditable_type' => BudgetReservation::class,
                'auditable_id' => $commitment->id,
                'new_values' => [
                    'source_key' => $commitment->source_key,
                    'budget_line_id' => $commitment->budget_line_id,
                    'amount' => $amount,
                    'status' => $status,
                ],
                'tags' => 'budget,commitment',
            ]);

            return $commitment->fresh(['budgetLine', 'transactions']);
        });
    }

    public function confirm(BudgetReservation $commitment, User $actor, ?string $reason = null): BudgetReservation
    {
        return DB::transaction(function () use ($commitment, $actor, $reason) {
            $commitment = BudgetReservation::query()->whereKey($commitment->id)->lockForUpdate()->firstOrFail();
            if ($commitment->isReleased()) {
                throw ValidationException::withMessages(['status' => 'Cannot confirm a released commitment.']);
            }
            if ($commitment->status === 'confirmed') {
                return $commitment;
            }

            $commitment->update([
                'status' => 'confirmed',
                'confirmed_at' => now(),
            ]);
            $this->recordTransaction($commitment, 'confirm', (float) $commitment->current_amount, $actor, $reason);

            return $commitment->fresh();
        });
    }

    public function adjust(BudgetReservation $commitment, float $newAmount, User $actor, ?string $reason = null): BudgetReservation
    {
        return DB::transaction(function () use ($commitment, $newAmount, $actor, $reason) {
            $commitment = BudgetReservation::query()->whereKey($commitment->id)->lockForUpdate()->firstOrFail();
            if ($commitment->isReleased()) {
                throw ValidationException::withMessages(['status' => 'Cannot adjust a released commitment.']);
            }

            $newAmount = round($newAmount, 2);
            if ($newAmount < 0) {
                throw ValidationException::withMessages(['amount' => 'Commitment amount cannot be negative.']);
            }

            $delta = round($newAmount - (float) $commitment->current_amount, 2);
            if ($delta > 0 && $commitment->budget_line_id) {
                $check = $this->availability->check((int) $commitment->budget_line_id, $delta, lock: true);
                // When increasing, available already excludes this commitment's current_amount,
                // so we need available >= delta.
                if (! $check['sufficient']) {
                    throw ValidationException::withMessages([
                        'amount' => 'Insufficient available budget to increase commitment.',
                    ]);
                }
            }

            $commitment->update([
                'current_amount' => $newAmount,
                'reserved_amount' => $newAmount,
                'status' => $newAmount <= 0 ? 'released' : $commitment->status,
                'released_at' => $newAmount <= 0 ? now() : $commitment->released_at,
                'released_by' => $newAmount <= 0 ? $actor->id : $commitment->released_by,
            ]);

            $this->recordTransaction($commitment, 'adjust', $delta, $actor, $reason, [
                'new_amount' => $newAmount,
            ]);

            AuditLog::record('budget.commitment_adjusted', [
                'auditable_type' => BudgetReservation::class,
                'auditable_id' => $commitment->id,
                'new_values' => ['current_amount' => $newAmount, 'delta' => $delta],
                'tags' => 'budget,commitment',
            ]);

            return $commitment->fresh();
        });
    }

    /**
     * Move obligation to a successor source without stacking available impact.
     *
     * @param  array{
     *   source_type:string,
     *   source_id:int,
     *   source_key:string,
     *   amount?:float|int|string,
     *   budget_line_id?:int,
     *   currency?:string,
     *   notes?:?string,
     *   idempotency_key?:?string,
     *   procurement_request_id?:?int,
     *   travel_request_id?:?int,
     *   programme_id?:?int
     * }  $successor
     */
    public function transfer(BudgetReservation $parent, array $successor, User $actor): BudgetReservation
    {
        return DB::transaction(function () use ($parent, $successor, $actor) {
            $parent = BudgetReservation::query()->whereKey($parent->id)->lockForUpdate()->firstOrFail();
            if ($parent->isReleased() || (float) $parent->current_amount <= 0) {
                throw ValidationException::withMessages(['status' => 'Cannot transfer a released or zero commitment.']);
            }

            $existing = $this->findBySourceKey((int) $parent->tenant_id, $successor['source_key']);
            if ($existing) {
                return $existing;
            }

            $amount = round((float) ($successor['amount'] ?? $parent->current_amount), 2);
            $lineId = (int) ($successor['budget_line_id'] ?? $parent->budget_line_id);
            if (! $lineId) {
                throw ValidationException::withMessages(['budget_line_id' => 'Budget line is required for transfer.']);
            }

            // Release parent first so availability is free for successor of same amount.
            $parent->update([
                'current_amount' => 0,
                'reserved_amount' => 0,
                'status' => 'closed',
                'released_at' => now(),
                'released_by' => $actor->id,
            ]);
            $this->recordTransaction($parent, 'transfer', -$amount, $actor, 'Transferred to '.$successor['source_key'], [
                'successor_source_key' => $successor['source_key'],
            ]);

            $child = $this->reserve([
                'tenant_id' => $parent->tenant_id,
                'budget_line_id' => $lineId,
                'amount' => $amount,
                'source_type' => $successor['source_type'],
                'source_id' => $successor['source_id'],
                'source_key' => $successor['source_key'],
                'currency' => $successor['currency'] ?? $parent->currency,
                'notes' => $successor['notes'] ?? ('Transferred from '.$parent->source_key),
                'idempotency_key' => $successor['idempotency_key'] ?? null,
                'programme_id' => $successor['programme_id'] ?? $parent->programme_id,
                'procurement_request_id' => $successor['procurement_request_id'] ?? null,
                'travel_request_id' => $successor['travel_request_id'] ?? null,
                'parent_commitment_id' => $parent->id,
                'commitment_chain_id' => $parent->commitment_chain_id,
                'confirm' => true,
            ], $actor);

            return $child;
        });
    }

    public function release(BudgetReservation $commitment, User $actor, ?string $reason = null): BudgetReservation
    {
        return DB::transaction(function () use ($commitment, $actor, $reason) {
            $commitment = BudgetReservation::query()->whereKey($commitment->id)->lockForUpdate()->firstOrFail();
            if ($commitment->isReleased()) {
                return $commitment;
            }

            $amount = (float) $commitment->current_amount;
            $commitment->update([
                'current_amount' => 0,
                'reserved_amount' => 0,
                'status' => 'released',
                'released_at' => now(),
                'released_by' => $actor->id,
            ]);
            $this->recordTransaction($commitment, 'release', -$amount, $actor, $reason);

            AuditLog::record('budget.commitment_released', [
                'auditable_type' => BudgetReservation::class,
                'auditable_id' => $commitment->id,
                'new_values' => ['released_amount' => $amount],
                'tags' => 'budget,commitment',
            ]);

            return $commitment->fresh();
        });
    }

    public function consume(BudgetReservation $commitment, float $amount, User $actor, ?string $reason = null): BudgetReservation
    {
        return DB::transaction(function () use ($commitment, $amount, $actor, $reason) {
            $commitment = BudgetReservation::query()->whereKey($commitment->id)->lockForUpdate()->firstOrFail();
            if ($commitment->isReleased()) {
                throw ValidationException::withMessages(['status' => 'Cannot consume a released commitment.']);
            }

            $amount = round($amount, 2);
            if ($amount <= 0) {
                throw ValidationException::withMessages(['amount' => 'Consume amount must be positive.']);
            }
            if ($amount > (float) $commitment->current_amount + 1e-9) {
                throw ValidationException::withMessages(['amount' => 'Cannot consume more than the commitment balance.']);
            }

            $remaining = round((float) $commitment->current_amount - $amount, 2);
            $status = $remaining <= 0 ? 'fully_utilised' : 'partially_utilised';

            $commitment->update([
                'current_amount' => max(0, $remaining),
                'reserved_amount' => max(0, $remaining),
                'status' => $status,
                'consumed_at' => now(),
                'released_at' => $remaining <= 0 ? now() : $commitment->released_at,
                'released_by' => $remaining <= 0 ? $actor->id : $commitment->released_by,
            ]);
            $this->recordTransaction($commitment, 'consume', -$amount, $actor, $reason);

            return $commitment->fresh();
        });
    }

    private function recordTransaction(
        BudgetReservation $commitment,
        string $type,
        float $amount,
        User $actor,
        ?string $reason = null,
        array $meta = [],
    ): BudgetCommitmentTransaction {
        return BudgetCommitmentTransaction::create([
            'budget_reservation_id' => $commitment->id,
            'type' => $type,
            'amount' => $amount,
            'balance_after' => (float) $commitment->current_amount,
            'actor_id' => $actor->id,
            'reason' => $reason,
            'meta' => $meta ?: null,
        ]);
    }
}
