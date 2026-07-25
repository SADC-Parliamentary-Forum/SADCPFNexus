<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Payroll recovery adapter driver
    |--------------------------------------------------------------------------
    |
    | Controls how salary-advance payroll recoveries are scheduled / recorded.
    | Production default is "manual" (Finance records recovery against BCRE).
    |
    | Supported drivers:
    |   - manual   — ManualPayrollRecoveryAdapter (default, production-safe)
    |   - null     — alias of disabled
    |   - disabled — NullPayrollRecoveryAdapter (blocks schedule/record)
    |   - vendor   — only if SALARY_ADVANCE_PAYROLL_VENDOR_CLASS implements the
    |                PayrollRecoveryAdapterInterface; otherwise binding rejects
    |                the unconfigured vendor at boot / resolve time
    |
    | Do NOT put vendor API secrets here. Vendor credentials belong in a
    | dedicated vault / env namespace owned by the authorised vendor adapter.
    |
    */

    'payroll_recovery_driver' => env('SALARY_ADVANCE_PAYROLL_DRIVER', 'manual'),

    /*
    | Fully-qualified class name for a future authorised vendor adapter.
    | Must implement App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface.
    | Leave null until a real vendor implementation is reviewed and approved.
    */
    'payroll_vendor_class' => env('SALARY_ADVANCE_PAYROLL_VENDOR_CLASS'),

];
