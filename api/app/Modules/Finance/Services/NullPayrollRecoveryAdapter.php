<?php

namespace App\Modules\Finance\Services;

use App\Models\SalaryAdvanceRequest;
use App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface;
use Illuminate\Validation\ValidationException;

/**
 * Explicitly disabled payroll recovery adapter.
 * Schedule / record fail closed until an authorised driver is selected.
 */
class NullPayrollRecoveryAdapter implements PayrollRecoveryAdapterInterface
{
    public function mode(): string
    {
        return 'disabled';
    }

    public function adapterKey(): string
    {
        return 'null';
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
            'driver'              => 'disabled',
            'enabled'             => false,
            'provider'            => null,
            'message'             => 'Payroll recovery adapter is disabled. Set SALARY_ADVANCE_PAYROLL_DRIVER=manual to restore manual recording.',
            'coming_soon'         => false,
            'supports_auto_push'  => false,
            'supports_auto_pull'  => false,
            'recording_mode'      => 'disabled',
        ];
    }

    public function schedule(SalaryAdvanceRequest $advance, array $data): array
    {
        throw ValidationException::withMessages([
            'adapter' => ['Payroll recovery scheduling is disabled. Switch the payroll driver to manual.'],
        ]);
    }

    public function record(SalaryAdvanceRequest $advance, array $data): array
    {
        throw ValidationException::withMessages([
            'adapter' => ['Payroll recovery recording is disabled. Switch the payroll driver to manual.'],
        ]);
    }

    public function queryStatus(SalaryAdvanceRequest $advance): array
    {
        return [
            'adapter'                         => $this->adapterKey(),
            'recovery_status'                 => $advance->recovery_status,
            'recovered_amount'                => (float) ($advance->recovered_amount ?? 0),
            'outstanding_amount'              => null,
            'intended_recovery_payroll_date'  => $advance->intended_recovery_payroll_date?->toDateString(),
            'vendor_status'                   => 'disabled',
            'message'                         => 'Payroll adapter disabled — no vendor status available.',
        ];
    }
}
