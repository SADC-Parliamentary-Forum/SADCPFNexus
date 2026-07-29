<?php

namespace App\Modules\Finance\Contracts;

interface VendorPayrollAdapterInterface
{
    public function driver(): string;

    /**
     * Import payslip rows. Only maps fields that are present — never invents OT rates.
     *
     * @param  array{lines?: array<int, array>, remote?: bool}  $payload
     * @return array<int, array{
     *   employee_number: string|null,
     *   period: string|null,
     *   gross: float|null,
     *   deductions: float|null,
     *   net: float|null,
     *   external_ref: string|null
     * }>
     */
    public function importPayslips(array $payload): array;
}
