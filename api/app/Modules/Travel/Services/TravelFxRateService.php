<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\TravelFxRate;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class TravelFxRateService
{
    public function list(int $tenantId, array $filters = []): LengthAwarePaginator
    {
        $q = TravelFxRate::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('effective_date')
            ->orderBy('from_currency');

        if (! empty($filters['from_currency'])) {
            $q->where('from_currency', strtoupper($filters['from_currency']));
        }
        if (! empty($filters['to_currency'])) {
            $q->where('to_currency', strtoupper($filters['to_currency']));
        }

        return $q->paginate($filters['per_page'] ?? 50);
    }

    public function upsert(array $data, User $user): TravelFxRate
    {
        if (! $user->can('travel.finance-review') && ! $user->can('travel.admin') && ! $user->isSystemAdmin()
            && ! $user->hasRole('Finance Controller')) {
            abort(403, 'Only Finance/Admin may manage FX rates.');
        }

        $payload = [
            'tenant_id' => $user->tenant_id,
            'from_currency' => strtoupper($data['from_currency']),
            'to_currency' => strtoupper($data['to_currency']),
            'rate' => (float) $data['rate'],
            'effective_date' => $data['effective_date'],
            'source' => $data['source'] ?? 'manual',
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ];

        if ($payload['rate'] <= 0) {
            throw ValidationException::withMessages(['rate' => 'FX rate must be positive.']);
        }

        if (! empty($data['id'])) {
            $rate = TravelFxRate::where('tenant_id', $user->tenant_id)->findOrFail($data['id']);
            $rate->update(collect($payload)->except(['tenant_id', 'created_by'])->all());

            return $rate->fresh();
        }

        $rate = TravelFxRate::create($payload);
        AuditLog::record('travel.fx_rate_saved', [
            'auditable_type' => TravelFxRate::class,
            'auditable_id' => $rate->id,
            'new_values' => $payload,
        ]);

        return $rate;
    }

    /**
     * Hint whether booking costs likely need a procurement link.
     */
    public function procurementLinkSuggested(TravelRequest $travel): bool
    {
        $threshold = (float) config('travel.procurement_link_threshold', 10000);
        $estimate = (float) ($travel->personal_incremental_cost ?? 0)
            + (float) ($travel->estimated_dsa ?? 0)
            + (float) ($travel->finance_dsa_total ?? 0);

        return $estimate >= $threshold || (bool) $travel->procurement_link_required;
    }
}
