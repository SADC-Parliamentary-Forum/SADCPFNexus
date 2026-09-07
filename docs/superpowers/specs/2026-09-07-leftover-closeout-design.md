# Leftover closeout — design

**Date:** 2026-09-07  
**Branch:** `cursor/leftover-closeout-9293`

## Assumptions

- Operator-owned launch rows stay unsigned: UAT, AC-8/9/10 freeze/migrate evidence, restore-drill RTO/RPO, staging IDOR results, governance Pending answers, live vendor secrets, Sentry DSN, pen-test.
- Code must not invent secrets or tick those rows Done.
- Explicit OOS stays OOS: full mobile parity, FA↔stock GL merge, auto-award, paid GDS, collapsing 135 UX IA dual-surface tickets, adding a 7th sidebar child.
- Existing open PRs are landed by rebase, not rewritten: workplan #27, deploy #33, procurement #29, payslips #22.
- Lifecycle #20 stays unmerged until green.

## In this closeout (code)

1. `/hr` — remove the eight-tab overflow strip. Hub cards remain the destinations. Overview stats, quick actions, and recent timesheets stay on the hub. EN/FR/PT.
2. Remaining Risk subpages — ModulePageHeader + `risk.hub` breadcrumbs; wrapping actions; no underline-as-button; labelled controls; EN/FR/PT chrome. Sidebar stays four children.
3. People registers — search labelled fields, not `JSON.stringify(row)`.
4. Asset import — labelled summary instead of raw JSON `<pre>`.
5. Remaining `alert()` on HR files / correspondence detail / finance balance register → toast.
6. Stale `ui-ux-remediation` contracts aligned to current honest behaviour (unknown catch, DSA `min={0}`, i18n toast dismiss, dashboard modules in `dashboardAccess.ts`).
7. Rebased existing PRs as above.

## Architecture

Web-only chrome and i18n for (1)–(6). No new APIs. Admin Web Portal remains the control plane.

## Explicitly not built

Operator credentials, UAT signatures, 135 IA collapses, #20 merge, Play/ASC submit.
