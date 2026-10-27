<?php

// /api/v1/finance routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Finance - Salary Advances, Payslips, Summary, and Budgets
Route::prefix('finance')->group(function () {
    Route::apiResource('budgets', \App\Http\Controllers\Api\V1\Finance\BudgetController::class);
    Route::get('summary', [\App\Http\Controllers\Api\V1\Finance\FinanceSummaryController::class, 'summary']);
    Route::get('payslips', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'index']);
    Route::get('payslips/{payslip}', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'show']);
    Route::get('payslips/{payslip}/download', [\App\Http\Controllers\Api\V1\Finance\PayslipController::class, 'download']);
    Route::get('payroll/imports', [\App\Http\Controllers\Api\V1\Finance\PayrollImportController::class, 'index']);
    Route::post('payroll/imports', [\App\Http\Controllers\Api\V1\Finance\PayrollImportController::class, 'store']);
    Route::get('payroll/imports/{payrollImportBatch}', [\App\Http\Controllers\Api\V1\Finance\PayrollImportController::class, 'show']);
    Route::post('payroll/imports/{payrollImportBatch}/stage', [\App\Http\Controllers\Api\V1\Finance\PayrollImportController::class, 'stage']);
    Route::get('advances/eligibility', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'eligibility']);
    Route::get('advances/dashboard', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'dashboard']);
    Route::get('advances/employee-summary', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'employeeSummary']);
    Route::get('advances/reconciliations', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'reconciliations']);
    Route::get('advances/policies', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'policies']);
    Route::post('advances/policies', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'storePolicy']);
    Route::get('advances/payroll-integration', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'payrollIntegration']);
    Route::get('advances/policy-exceptions', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'policyExceptions']);
    Route::post('advances/policy-exceptions', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'storePolicyException']);
    Route::post('advances/policy-exceptions/{exception}/approve', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'approvePolicyException']);
    Route::post('advances/policy-exceptions/{exception}/revoke', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'revokePolicyException']);
    Route::get('advances', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'index']);
    Route::post('advances', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'store']);
    Route::get('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'show']);
    Route::put('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'update']);
    Route::delete('advances/{salaryAdvanceRequest}', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'destroy']);
    Route::post('advances/{salaryAdvanceRequest}/submit', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'submit']);
    Route::post('advances/{salaryAdvanceRequest}/finance-certify', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'financeCertify']);
    Route::post('advances/{salaryAdvanceRequest}/finance-return', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'financeReturn']);
    Route::post('advances/{salaryAdvanceRequest}/mark-not-eligible', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'markNotEligible']);
    Route::post('advances/{salaryAdvanceRequest}/approve', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'approve']);
    Route::post('advances/{salaryAdvanceRequest}/reject', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'reject']);
    Route::post('advances/{salaryAdvanceRequest}/return', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'returnForCorrection']);
    Route::post('advances/{salaryAdvanceRequest}/withdraw', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'withdraw']);
    Route::post('advances/{salaryAdvanceRequest}/resubmit', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'resubmit']);
    Route::post('advances/{salaryAdvanceRequest}/record-payment', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'recordPayment']);
    Route::post('advances/{salaryAdvanceRequest}/schedule-recovery', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'scheduleRecovery']);
    Route::post('advances/{salaryAdvanceRequest}/record-recovery', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'recordRecovery']);
    Route::post('advances/{salaryAdvanceRequest}/close', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'close']);
    Route::post('advances/{salaryAdvanceRequest}/reconciliations/{reconciliation}/resolve', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'resolveReconciliation']);
    Route::get('advances/{salaryAdvanceRequest}/ledger', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'ledger']);
    Route::get('advances/{salaryAdvanceRequest}/pdf', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'pdf']);
    Route::get('advances/{salaryAdvanceRequest}/certificate', [\App\Http\Controllers\Api\V1\Finance\SalaryAdvanceController::class, 'certificate']);

    // Balance Control & Reconciliation Engine (BCRE)
    foreach (['balance-register', 'balance-registers'] as $balanceRegisterPrefix) {
        Route::prefix($balanceRegisterPrefix)->group(function () {
            Route::get('dashboard', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'dashboard']);
            Route::get('exceptions', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'exceptions']);
            Route::get('/', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'store']);
            Route::get('{balanceRegister}', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'show']);
            Route::put('{balanceRegister}', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'update']);
            Route::post('{balanceRegister}/lock', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'lock']);
            Route::post('{balanceRegister}/unlock', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'unlock']);
            Route::post('{balanceRegister}/acknowledge', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'acknowledge']);
            Route::get('{balanceRegister}/transactions', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'transactions']);
            Route::post('{balanceRegister}/transactions', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'storeTransaction']);
            Route::get('{balanceRegister}/transactions/{balanceTransaction}/verify', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'getVerification']);
            Route::post('{balanceRegister}/transactions/{balanceTransaction}/verify', [\App\Http\Controllers\Api\V1\Finance\BalanceRegisterController::class, 'storeVerification']);
        });
    }
});
