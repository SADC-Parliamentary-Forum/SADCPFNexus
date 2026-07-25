# Salary Advance — plugging a payroll vendor adapter later

**Date:** 2026-07-25  
**Status:** Manual-only in production. Vendor path is a sealed extension point.

## Current production behaviour

- Driver: `SALARY_ADVANCE_PAYROLL_DRIVER=manual` (default)
- Class: `ManualPayrollRecoveryAdapter`
- Finance schedules recovery locally and records recoveries against BCRE with a **required** payroll transaction reference (`SA-REC-…` normalisation).
- Consolidation / parallel advances remain **disabled**.

## Driver matrix

| Driver | Env value | Behaviour |
|--------|-----------|-----------|
| Manual (default) | `manual` | Schedule + record locally; reference required |
| Disabled | `null` or `disabled` | Schedule/record rejected (422) |
| Vendor | `vendor` | **Rejected** until `SALARY_ADVANCE_PAYROLL_VENDOR_CLASS` points at a reviewed implementation |

Unknown drivers throw at resolve time (`InvalidArgumentException`).

## Interface contract

Implement `App\Modules\Finance\Contracts\PayrollRecoveryAdapterInterface`:

1. `status()` — settings / recovery-queue UX
2. `schedule(SalaryAdvanceRequest, array)` — schedule recovery (push or local)
3. `record(SalaryAdvanceRequest, array)` — prepare recovery recording (`reference_doc` required for BCRE)
4. `queryStatus(SalaryAdvanceRequest)` — per-advance status snapshot

Factory: `App\Modules\Finance\Services\PayrollRecoveryAdapterFactory`  
Config: `api/config/salary_advance.php`

## How to plug a vendor later (checklist)

1. Implement the interface in e.g. `App\Modules\Finance\Services\Vendors\AcmePayrollRecoveryAdapter`.
2. Keep **secrets** out of `config/salary_advance.php` — use a dedicated vault / env namespace owned by that adapter.
3. Set:
   ```bash
   SALARY_ADVANCE_PAYROLL_DRIVER=vendor
   SALARY_ADVANCE_PAYROLL_VENDOR_CLASS=App\Modules\Finance\Services\Vendors\AcmePayrollRecoveryAdapter
   ```
4. Add feature tests for schedule / record / queryStatus + fail-closed behaviour when the vendor is down.
5. Do **not** enable consolidation or parallel advances as part of a vendor plug-in.
6. Ship behind change control; leave production on `manual` until UAT signs off.

## Explicit non-goals (this release)

- No real third-party payroll API integration
- No vendor credentials in repo or `.env.example`
- No consolidation / instalments / parallel advances
