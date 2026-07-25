<?php

namespace App\Modules\Finance\Contracts;

use App\Models\SalaryAdvanceRequest;

/**
 * Abstraction for future payroll vendor adapters.
 *
 * Phase 3 ships ManualPayrollRecoveryAdapter only — no fake vendor integration.
 * Automated send/receive belongs to a later authorised adapter binding.
 */
interface PayrollRecoveryAdapterInterface
{
    public function mode(): string;

    public function adapterKey(): string;

    public function isEnabled(): bool;

    /**
     * @return array{
     *   mode: string,
     *   adapter: string,
     *   enabled: bool,
     *   provider: string|null,
     *   message: string,
     *   coming_soon: bool,
     *   supports_auto_push: bool,
     *   supports_auto_pull: bool
     * }
     */
    public function status(): array;

    /**
     * Normalize / require a payroll transaction reference for BCRE recovery posts.
     *
     * @param  array{reference_doc?: string|null, notes?: string|null, amount?: float|int|string}  $data
     */
    public function prepareRecoveryReference(SalaryAdvanceRequest $advance, array $data): string;
}
