<?php

namespace App\Modules\Finance\Contracts;

use App\Models\SalaryAdvanceRequest;

/**
 * Abstraction for salary-advance payroll recovery adapters.
 *
 * Production ships ManualPayrollRecoveryAdapter only. A future vendor adapter
 * may implement schedule / record / queryStatus without changing Finance
 * service orchestration. No third-party API secrets belong in this contract.
 */
interface PayrollRecoveryAdapterInterface
{
    public function mode(): string;

    public function adapterKey(): string;

    /**
     * True only when an authorised automated vendor path is active.
     * Manual and disabled adapters always return false.
     */
    public function isEnabled(): bool;

    /**
     * Adapter-level status for settings / recovery queue UX.
     *
     * @return array{
     *   mode: string,
     *   adapter: string,
     *   driver: string,
     *   enabled: bool,
     *   provider: string|null,
     *   message: string,
     *   coming_soon: bool,
     *   supports_auto_push: bool,
     *   supports_auto_pull: bool,
     *   recording_mode: string
     * }
     */
    public function status(): array;

    /**
     * Schedule recovery for an advance (manual = local metadata only).
     *
     * @param  array{intended_recovery_payroll_date?: string|null}  $data
     * @return array{
     *   scheduled: bool,
     *   payroll_date: string|null,
     *   vendor_reference: string|null,
     *   message: string
     * }
     */
    public function schedule(SalaryAdvanceRequest $advance, array $data): array;

    /**
     * Prepare / push a recovery recording.
     * Manual path normalizes and requires a payroll transaction reference.
     *
     * @param  array{reference_doc?: string|null, notes?: string|null, amount?: float|int|string}  $data
     * @return array{
     *   reference_doc: string,
     *   vendor_payload: array|null,
     *   message: string
     * }
     */
    public function record(SalaryAdvanceRequest $advance, array $data): array;

    /**
     * Query recovery status for a single advance (local snapshot until vendor).
     *
     * @return array{
     *   adapter: string,
     *   recovery_status: string|null,
     *   recovered_amount: float,
     *   outstanding_amount: float|null,
     *   intended_recovery_payroll_date: string|null,
     *   vendor_status: string|null,
     *   message: string
     * }
     */
    public function queryStatus(SalaryAdvanceRequest $advance): array;
}
