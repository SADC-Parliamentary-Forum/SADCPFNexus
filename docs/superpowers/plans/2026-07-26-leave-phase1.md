# Leave Phase 1 Implementation Plan

**Goal:** Move Leave Management from a flat leave request into the PRD foundation: policy versions, configurable leave types, multi-segment applications, ledger-backed balances, public-holiday-aware calculations, and validated TOIL consumption.

## Slice A - Foundation shipped 2026-07-26

- [x] Add policy/version and leave type tables with structural seeding.
- [x] Add leave segments so one application can contain multiple leave categories.
- [x] Add leave ledger entries as the authoritative balance source.
- [x] Add TOIL credit and extension tables for Leave-owned TOIL entitlement.
- [x] Add server-side working-day preview using default holiday calendars and SADC holiday entries.
- [x] Preserve legacy single-segment request payloads by converting them into one segment.
- [x] Add `GET /leave/types` and `POST /leave/preview`.
- [x] Return segments/policy on leave create/show.
- [x] Reject annual leave submission when available balance is insufficient.
- [x] Reject expired TOIL usage without an SG extension.
- [x] Keep travel-generated TOIL validated before leave use; Travel still never auto-creates leave.
- [x] Regression coverage: `php artisan test --filter=Leave` green.

## Next slices

- [x] HR certification actions per segment: certify, certify with condition, return, mark ineligible.
- [x] HOD recommendation action: recommend, not recommend, return for correction.
- [x] Stage visibility fields for recommendation/certification transitions.
- [ ] Final authorisation fields and workflow stage holder mapping from configured workflow steps.
- [x] Monthly annual accrual command from configured policy rules.
- [x] Sick leave certificate enforcement.
- [x] Confidential medical-document access tiers.
- [x] Sick leave four-year full-pay, half-pay, unpaid cycle tracking.
- [x] Maternity, paternity, compassionate, study, unpaid, and home-leave policy validators.
- [x] TOIL consumption order by earliest expiry first, partial usage, expiry alerts, and SG extension workflow.
- [x] Payroll impact records for non-sick unpaid leave and maternity/social-security tracking.
- [x] FORM-005 PDF with Parts A-C and segment-level certification.
- [ ] Team/HR calendars with medical leave privacy masking.
- [ ] Leave register, balance, TOIL, medical compliance, payroll-impact, and audit exports.
- [x] Leave detail page parity for workflow holder, segment certification, policy version, and FORM-005 download.
- [x] Web UI multi-segment application with server preview and TOIL credit selection.
- [ ] Web UI parity for TOIL expiry, certification queues, reports, and calendars.

## Slice B - Recommendation/certification shipped 2026-07-26

- Added request-level recommendation and certification state.
- Added segment-level certification state, eligible days, document status, certifier, timestamp, and comments.
- Added `POST /leave/requests/{id}/recommend`.
- Added `POST /leave/requests/{id}/certify`.
- Enforced self-action controls for recommendation/certification.
- Verification: `php artisan test --filter=Leave` -> 43 passed / 219 assertions.
