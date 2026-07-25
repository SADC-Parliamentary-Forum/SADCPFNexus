# Salary Advance Phase 3 — deferred gap close-out

**Date:** 2026-07-25  
**Branch:** `feat/salary-advance-phase3-gaps-2026-07-25`  
**Spec:** `docs/superpowers/specs/2026-07-25-salary-advance-design.md`

## Done

1. **Personnel-file wiring** — On full recovery / close, FORM-002 PDF is stored on the employee’s `HrPersonalFile` as a confidential `HrFileDocument` (`source_module=salary_advance`), with timeline event + audit. Detail UI links to `/hr/files/{id}`.
2. **Payroll recovery harden** — `PayrollRecoveryAdapterInterface` + `ManualPayrollRecoveryAdapter` (default). Recovery requires payroll transaction reference; refs are normalized with `SA-REC-…` prefix. Recovery queue shows payment ref, payroll date, recovered, outstanding.
3. **Policy exceptions** — `salary_advance_policy_exceptions` entity with create/approve/revoke + audit. Visible on eligibility; **never** silently bypasses rules (`applies_automatically=false`).
4. **Opening-balance tooling** — `php artisan salary-advance:import-opening-balance {email} {amount} [--reference=] [--paid-at=] [--recovered]`.

## Explicitly deferred / unchanged

- Consolidation / parallel advances / instalments
- Principal=Director, net×50%, BCRE-on-payment, Finance-first
- Full payroll vendor adapter (no fake vendor)
- Heavy historical data migration
- Automatic eligibility bypass via approved exceptions (controlled apply path = future)

## UI paths

- `/salary-advances/queues/recovery` — hardened recovery queue
- `/salary-advances/{id}` (and `/finance/advances/{id}`) — personnel file link when closed; recovery requires reference
- `/salary-advances/settings` — payroll adapter status + policy exceptions admin

## Tests

`api/tests/Feature/Finance/SalaryAdvancePhase3Test.php`
