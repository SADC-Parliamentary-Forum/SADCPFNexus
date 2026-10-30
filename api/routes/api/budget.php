<?php

// /api/v1/budget routes. Required from routes/api.php inside the authenticated
// group (auth:sanctum, session check, throttle, SetRlsContext, idempotency) —
// never register these routes outside that group.

use Illuminate\Support\Facades\Route;

// Budget Management — availability, commitments, actuals (Phase 1)
Route::prefix('budget')->group(function () {
    Route::get('financial-years', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'financialYears']);
    Route::post('financial-years', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'storeFinancialYear']);
    Route::get('funding-sources', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'fundingSources']);
    Route::post('funding-sources', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'storeFundingSource']);
    Route::get('lines', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'lines']);
    Route::get('lines/{budgetLine}/availability', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'availability']);
    Route::post('availability/check', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'checkAvailability']);
    Route::post('commitments/reserve', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'reserve']);
    Route::post('commitments/{commitment}/confirm', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'confirm']);
    Route::post('commitments/{commitment}/adjust', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'adjust']);
    Route::post('commitments/{commitment}/transfer', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'transfer']);
    Route::post('commitments/{commitment}/release', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'release']);
    Route::post('commitments/{commitment}/consume', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'consume']);
    Route::post('actuals', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'postActual']);
    Route::post('journals', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'postJournal']);
    Route::post('actuals/import', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'importActuals']);
    Route::get('variance', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'variances']);
    Route::post('variance/scan', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'scanVariances']);
    Route::post('variance/{variance}/explanation', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'explainVariance']);
    Route::post('variance/explanations/{explanation}/review', [\App\Http\Controllers\Api\V1\Budget\BudgetControlController::class, 'reviewVarianceExplanation']);

    // Phase 2 A1 — annual cycle
    Route::get('cycles', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'index']);
    Route::post('cycles', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'store']);
    Route::get('cycles/{cycle}', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'show']);
    Route::post('cycles/{cycle}/guidelines', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'publishGuidelines']);
    Route::post('cycles/{cycle}/advance', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'advance']);
    Route::post('cycles/{cycle}/return', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'returnToDepartments']);
    Route::post('cycles/{cycle}/sg-approve', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'sgApprove']);
    Route::post('cycles/{cycle}/lock', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'lock']);
    Route::get('cycles/{cycle}/decisions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'indexDecisions']);
    Route::post('cycles/{cycle}/decisions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'storeDecision']);

    Route::get('submissions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'indexSubmissions']);
    Route::post('submissions', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'storeSubmission']);
    Route::get('submissions/{submission}', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'showSubmission']);
    Route::put('submissions/{submission}', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'updateSubmission']);
    Route::post('submissions/{submission}/submit', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'submitSubmission']);
    Route::post('submissions/{submission}/accept', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'acceptSubmission']);
    Route::post('submissions/{submission}/consolidate', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'consolidateSubmission']);
    Route::post('submissions/{submission}/return', [\App\Http\Controllers\Api\V1\Budget\BudgetCycleController::class, 'returnSubmission']);

    // Phase 2 B — mid-year change control
    Route::get('changes', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'index']);
    Route::post('changes', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'store']);
    Route::get('changes/{change}', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'show']);
    Route::put('changes/{change}', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'update']);
    Route::post('changes/{change}/submit', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'submit']);
    Route::post('changes/{change}/finance-decide', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'financeDecide']);
    Route::post('changes/{change}/sg-decide', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'sgDecide']);
    Route::post('changes/{change}/apply', [\App\Http\Controllers\Api\V1\Budget\BudgetChangeController::class, 'apply']);

    // Read-only reports pack
    Route::get('reports/utilisation', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'utilisation']);
    Route::get('reports/commitment-ageing', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'commitmentAgeing']);
    Route::get('reports/change-register', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'changeRegister']);
    Route::get('reports/cycle-status', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'cycleStatus']);
    Route::get('reports/{report}/export', [\App\Http\Controllers\Api\V1\Budget\BudgetReportController::class, 'export'])
        ->where('report', 'utilisation|commitment-ageing|change-register|cycle-status');

    // Cashflow / scenario planning
    Route::get('cashflow/forecast', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'forecast']);
    Route::get('cashflow/forecast/export', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'exportForecast']);
    Route::get('cashflow/compare', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'compare']);
    Route::get('cashflow/compare/export', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'exportCompare']);
    Route::get('cashflow/inflows', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'indexInflows']);
    Route::post('cashflow/inflows', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'storeInflow']);
    Route::put('cashflow/inflows/{inflow}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'updateInflow']);
    Route::delete('cashflow/inflows/{inflow}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'destroyInflow']);
    Route::get('cashflow/scenarios', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'indexScenarios']);
    Route::post('cashflow/scenarios', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'storeScenario']);
    Route::get('cashflow/scenarios/{scenario}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'showScenario']);
    Route::put('cashflow/scenarios/{scenario}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'updateScenario']);
    Route::delete('cashflow/scenarios/{scenario}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'destroyScenario']);
    Route::post('cashflow/scenarios/{scenario}/adjustments', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'storeAdjustment']);
    Route::delete('cashflow/scenarios/{scenario}/adjustments/{adjustment}', [\App\Http\Controllers\Api\V1\Budget\CashflowController::class, 'destroyAdjustment']);

    // Gap pack 3 — FX + donor contribution calendars (no bank/GL)
    Route::get('fx-rates', [\App\Http\Controllers\Api\V1\Budget\BudgetFxRateController::class, 'index']);
    Route::post('fx-rates', [\App\Http\Controllers\Api\V1\Budget\BudgetFxRateController::class, 'store']);
    Route::post('fx-rates/convert', [\App\Http\Controllers\Api\V1\Budget\BudgetFxRateController::class, 'convert']);
    Route::get('contribution-schedules', [\App\Http\Controllers\Api\V1\Budget\BudgetContributionScheduleController::class, 'index']);
    Route::post('contribution-schedules', [\App\Http\Controllers\Api\V1\Budget\BudgetContributionScheduleController::class, 'store']);
    Route::get('contribution-schedules/{contributionSchedule}/upcoming', [\App\Http\Controllers\Api\V1\Budget\BudgetContributionScheduleController::class, 'upcoming']);
});
