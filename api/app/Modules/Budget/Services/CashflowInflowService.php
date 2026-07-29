<?php

namespace App\Modules\Budget\Services;

use App\Models\CashflowInflow;
use App\Models\CashflowScenario;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CashflowInflowService
{
    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, CashflowInflow>
     */
    public function list(int $tenantId, array $filters = []): Collection
    {
        return CashflowInflow::query()
            ->with(['fundingSource:id,code,name', 'creator:id,name'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['financial_year_id']), fn ($q) => $q->where('financial_year_id', (int) $filters['financial_year_id']))
            ->when(! empty($filters['source_type']), fn ($q) => $q->where('source_type', $filters['source_type']))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->orderBy('period')
            ->orderBy('id')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(int $tenantId, array $data, User $user): CashflowInflow
    {
        $this->assertPeriod($data['period'] ?? null);

        return CashflowInflow::create([
            'tenant_id' => $tenantId,
            'financial_year_id' => (int) $data['financial_year_id'],
            'source_type' => $data['source_type'],
            'label' => $data['label'],
            'counterparty_name' => $data['counterparty_name'] ?? null,
            'period' => $data['period'],
            'amount' => (float) $data['amount'],
            'currency' => strtoupper($data['currency'] ?? 'NAD'),
            'status' => $data['status'] ?? 'planned',
            'funding_source_id' => $data['funding_source_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(CashflowInflow $inflow, array $data): CashflowInflow
    {
        if (array_key_exists('period', $data)) {
            $this->assertPeriod($data['period']);
        }

        $inflow->fill(collect($data)->only([
            'source_type', 'label', 'counterparty_name', 'period', 'amount',
            'currency', 'status', 'funding_source_id', 'notes',
        ])->all());
        if (isset($data['currency'])) {
            $inflow->currency = strtoupper((string) $data['currency']);
        }
        $inflow->save();

        return $inflow->fresh(['fundingSource:id,code,name', 'creator:id,name']);
    }

    public function delete(CashflowInflow $inflow): void
    {
        $inflow->delete();
    }

    private function assertPeriod(?string $period): void
    {
        if (! is_string($period) || ! preg_match('/^\d{4}-\d{2}$/', $period)) {
            throw ValidationException::withMessages([
                'period' => ['Period must be YYYY-MM.'],
            ]);
        }
    }
}
