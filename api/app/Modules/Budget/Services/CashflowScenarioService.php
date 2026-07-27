<?php

namespace App\Modules\Budget\Services;

use App\Models\CashflowScenario;
use App\Models\CashflowScenarioAdjustment;
use App\Models\FinancialYear;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashflowScenarioService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return \Illuminate\Support\Collection<int, CashflowScenario>
     */
    public function list(int $tenantId, array $filters = [])
    {
        return CashflowScenario::query()
            ->withCount('adjustments')
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['financial_year_id']), fn ($q) => $q->where('financial_year_id', (int) $filters['financial_year_id']))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->orderByDesc('updated_at')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(int $tenantId, array $data, User $actor): CashflowScenario
    {
        $fy = FinancialYear::query()
            ->where('tenant_id', $tenantId)
            ->whereKey((int) $data['financial_year_id'])
            ->firstOrFail();

        return CashflowScenario::create([
            'tenant_id' => $tenantId,
            'financial_year_id' => $fy->id,
            'name' => $data['name'],
            'kind' => $data['kind'] ?? 'base',
            'opening_balance' => (float) ($data['opening_balance'] ?? 0),
            'currency' => $data['currency'] ?? 'NAD',
            'status' => $data['status'] ?? 'draft',
            'notes' => $data['notes'] ?? null,
            'created_by' => $actor->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(CashflowScenario $scenario, array $data): CashflowScenario
    {
        $scenario->fill([
            'name' => $data['name'] ?? $scenario->name,
            'kind' => $data['kind'] ?? $scenario->kind,
            'opening_balance' => array_key_exists('opening_balance', $data)
                ? (float) $data['opening_balance']
                : $scenario->opening_balance,
            'currency' => $data['currency'] ?? $scenario->currency,
            'status' => $data['status'] ?? $scenario->status,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $scenario->notes,
        ]);
        $scenario->save();

        return $scenario->fresh('adjustments');
    }

    public function delete(CashflowScenario $scenario): void
    {
        DB::transaction(function () use ($scenario) {
            $scenario->adjustments()->delete();
            $scenario->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function addAdjustment(CashflowScenario $scenario, array $data): CashflowScenarioAdjustment
    {
        if (! preg_match('/^\d{4}-\d{2}$/', (string) ($data['period'] ?? ''))) {
            throw ValidationException::withMessages([
                'period' => ['Period must be YYYY-MM.'],
            ]);
        }

        return $scenario->adjustments()->create([
            'period' => $data['period'],
            'direction' => $data['direction'],
            'amount' => (float) $data['amount'],
            'label' => $data['label'] ?? null,
            'category' => $data['category'] ?? 'manual',
            'budget_reservation_id' => $data['budget_reservation_id'] ?? null,
            'meta' => $data['meta'] ?? null,
        ]);
    }

    public function deleteAdjustment(CashflowScenario $scenario, CashflowScenarioAdjustment $adjustment): void
    {
        if ((int) $adjustment->cashflow_scenario_id !== (int) $scenario->id) {
            abort(404);
        }
        $adjustment->delete();
    }
}
