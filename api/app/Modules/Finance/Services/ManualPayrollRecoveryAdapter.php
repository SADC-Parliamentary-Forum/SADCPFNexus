<?php

namespace App\Modules\Finance\Services;

use App\Models\SalaryAdvanceRequest;
use App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface;
use Illuminate\Validation\ValidationException;

/**
 * Default recovery path: Finance records payroll recovery manually against BCRE.
 * No external vendor API calls.
 */
class ManualPayrollRecoveryAdapter implements PayrollRecoveryAdapterInterface
{
    public function mode(): string
    {
        return 'manual';
    }

    public function adapterKey(): string
    {
        return 'manual';
    }

    public function isEnabled(): bool
    {
        return false;
    }

    public function status(): array
    {
        return [
            'mode'                => $this->mode(),
            'adapter'             => $this->adapterKey(),
            'driver'              => 'manual',
            'enabled'             => $this->isEnabled(),
            'provider'            => null,
            'message'             => 'Payroll recovery is recorded manually. An authorised payroll adapter can be bound later — no vendor integration is active.',
            'coming_soon'         => false,
            'supports_auto_push'  => false,
            'supports_auto_pull'  => false,
            'recording_mode'      => 'manual_reference_required',
        ];
    }

    public function schedule(SalaryAdvanceRequest $advance, array $data): array
    {
        $date = $data['intended_recovery_payroll_date']
            ?? $advance->intended_recovery_payroll_date?->toDateString();

        return [
            'scheduled'         => true,
            'payroll_date'      => $date,
            'vendor_reference'  => null,
            'message'           => 'Recovery scheduled locally. No vendor payroll push — Finance will record recovery manually.',
        ];
    }

    public function record(SalaryAdvanceRequest $advance, array $data): array
    {
        return [
            'reference_doc'  => $this->prepareRecoveryReference($advance, $data),
            'vendor_payload' => null,
            'message'        => 'Payroll recovery prepared for manual BCRE recording.',
        ];
    }

    public function queryStatus(SalaryAdvanceRequest $advance): array
    {
        $outstanding = $advance->balanceRegister
            ? (float) $advance->balanceRegister->balance
            : max(0, (float) $advance->amount - (float) ($advance->recovered_amount ?? 0));

        return [
            'adapter'                         => $this->adapterKey(),
            'recovery_status'                 => $advance->recovery_status,
            'recovered_amount'                => (float) ($advance->recovered_amount ?? 0),
            'outstanding_amount'              => $outstanding,
            'intended_recovery_payroll_date'  => $advance->intended_recovery_payroll_date?->toDateString(),
            'vendor_status'                   => null,
            'message'                         => 'Local recovery status (manual adapter — no vendor query).',
        ];
    }

    /**
     * Normalize / require a payroll transaction reference for BCRE recovery posts.
     *
     * @param  array{reference_doc?: string|null, notes?: string|null, amount?: float|int|string}  $data
     */
    public function prepareRecoveryReference(SalaryAdvanceRequest $advance, array $data): string
    {
        $ref = trim((string) ($data['reference_doc'] ?? ''));

        if ($ref === '') {
            throw ValidationException::withMessages([
                'reference_doc' => ['A payroll transaction reference is required for recovery recording.'],
            ]);
        }

        if (strlen($ref) > 120) {
            throw ValidationException::withMessages([
                'reference_doc' => ['Payroll transaction reference must be 120 characters or fewer.'],
            ]);
        }

        // Keep operator-supplied refs intact; stamp SA context only when not already prefixed.
        if (! str_starts_with(strtoupper($ref), 'SA-')) {
            return sprintf('SA-REC-%s-%s', $advance->reference_number, $ref);
        }

        return $ref;
    }
}
