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
            'enabled'             => $this->isEnabled(),
            'provider'            => null,
            'message'             => 'Payroll recovery is recorded manually. An authorised payroll adapter can be bound later — no vendor integration is active.',
            'coming_soon'         => false,
            'supports_auto_push'  => false,
            'supports_auto_pull'  => false,
        ];
    }

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
