<?php

namespace App\Modules\Finance\Services;

use App\Models\AuditLog;
use App\Models\BalanceRegister;
use App\Models\EmployeeSalaryAssignment;
use App\Models\LeaveBalance;
use App\Models\Payslip;
use App\Models\PayslipLineConfig;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class PayslipAutoFillService
{
    /**
     * Populate a payslip's details JSON from system data (grade band, allowances, BCRE, leave balance).
     * Returns the payslip unchanged if no salary assignment or line configs exist for the employee.
     */
    public function fill(Payslip $payslip): Payslip
    {
        $employee = $payslip->user;
        if (!$employee) {
            return $payslip;
        }

        $assignment = EmployeeSalaryAssignment::where('user_id', $employee->id)
            ->where('effective_from', '<=', Carbon::today())
            ->where(function ($q) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', Carbon::today());
            })
            ->whereNull('deleted_at')
            ->with(['gradeBand.leaveProfile', 'gradeBand.allowanceProfile', 'salaryScale'])
            ->latest('effective_from')
            ->first();

        if (!$assignment) {
            return $payslip;
        }

        $lineConfigs = PayslipLineConfig::where('user_id', $employee->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        if ($lineConfigs->isEmpty()) {
            return $payslip;
        }

        $details = $this->buildDetails($employee, $assignment, $lineConfigs);

        $gross           = collect($details['earnings'])->sum('amount');
        $totalDeductions = collect($details['deductions'])->sum('amount');
        $net             = $gross - $totalDeductions;

        $payslip->update([
            'details'          => $details,
            'gross_amount'     => $gross,
            'net_amount'       => $net,
            'total_deductions' => $totalDeductions,
            'employment_type'  => $assignment->employment_type ?? $payslip->employment_type,
        ]);

        AuditLog::record('payslip.auto_filled', [
            'auditable_type' => Payslip::class,
            'auditable_id'   => $payslip->id,
            'new_values'     => [
                'gross_amount'     => $gross,
                'net_amount'       => $net,
                'total_deductions' => $totalDeductions,
                'lines_count'      => $lineConfigs->count(),
            ],
            'tags' => 'payslip',
        ]);

        return $payslip->fresh();
    }

    /**
     * Compute the value for a system-sourced component_key.
     */
    public function computeSystemValue(string $key, User $employee, EmployeeSalaryAssignment $assignment): float
    {
        $gradeBand       = $assignment->gradeBand;
        $allowanceProfile = $gradeBand?->allowanceProfile;
        $salaryScale      = $assignment->salaryScale;

        return match ($key) {
            'basic_pay' => $this->computeBasicPay($salaryScale, $assignment->notch_number),

            'housing_allowance'       => (float) ($allowanceProfile?->housing_allowance ?? 0),
            'transport_allowance'     => (float) ($allowanceProfile?->transport_allowance ?? 0),
            'communication_allowance' => (float) ($allowanceProfile?->communication_allowance ?? 0),
            'medical_allowance'       => (float) ($allowanceProfile?->medical_allowance ?? 0),
            'subsistence_allowance'   => (float) ($allowanceProfile?->subsistence_allowance ?? 0),

            'advance_recovery' => (float) (
                BalanceRegister::where('employee_id', $employee->id)
                    ->where('module_type', 'salary_advance')
                    ->where('status', 'active')
                    ->latest()
                    ->value('installment_amount') ?? 0
            ),

            'annual_leave_balance' => (float) (
                LeaveBalance::where('user_id', $employee->id)
                    ->where('period_year', Carbon::now()->year)
                    ->value('annual_balance_days') ?? 0
            ),

            default => 0.0,
        };
    }

    /**
     * Assemble the full details JSON structure from line configs.
     */
    public function buildDetails(User $employee, EmployeeSalaryAssignment $assignment, Collection $lineConfigs): array
    {
        $gradeBand = $assignment->gradeBand;

        $earnings              = [];
        $deductions            = [];
        $company_contributions = [];
        $leave_balances        = [];

        foreach ($lineConfigs as $config) {
            if (!$config->is_visible) {
                continue;
            }

            $amount = $config->source === 'system'
                ? $this->computeSystemValue($config->component_key, $employee, $assignment)
                : (float) ($config->fixed_amount ?? 0);

            $line = [
                'key'    => $config->component_key,
                'label'  => $config->label,
                'amount' => $amount,
                'source' => $config->source,
            ];

            if ($config->component_type === 'info' && $config->component_key === 'annual_leave_balance') {
                $leave_balances[] = ['label' => $config->label, 'days' => (int) $amount];
                continue;
            }

            match ($config->component_type) {
                'earning'              => $earnings[]              = $line,
                'deduction'            => $deductions[]            = $line,
                'company_contribution' => $company_contributions[] = $line,
                default                => null,
            };
        }

        $gross           = array_sum(array_column($earnings, 'amount'));
        $totalDeductions = array_sum(array_column($deductions, 'amount'));

        return [
            'header' => [
                'employee_name'   => $employee->name,
                'employee_id'     => $employee->id,
                'period'          => Carbon::now()->format('F Y'),
                'employment_type' => $assignment->employment_type ?? '',
                'grade_band'      => $gradeBand?->code ?? $gradeBand?->label ?? '',
                'notch'           => $assignment->notch_number,
            ],
            'earnings'              => $earnings,
            'deductions'            => $deductions,
            'company_contributions' => $company_contributions,
            'leave_balances'        => $leave_balances,
            'gross_amount'          => $gross,
            'total_deductions'      => $totalDeductions,
            'net_amount'            => $gross - $totalDeductions,
        ];
    }

    private function computeBasicPay(?object $salaryScale, int $notchNumber): float
    {
        if (!$salaryScale || empty($salaryScale->notches)) {
            return 0.0;
        }

        $index = $notchNumber - 1;
        $notches = $salaryScale->notches;

        if (!isset($notches[$index])) {
            return 0.0;
        }

        return (float) ($notches[$index]['monthly'] ?? 0);
    }
}
