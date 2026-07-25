# Salary Advance Phase 2 Implementation Plan

**Goal:** Close audit gaps after Phase 1 MVP — Navigation IA (§5), employee/finance dashboards, outstanding/register/reconciliation queues, policy settings UI, expanded SA reports. Keep backend `/api/v1/finance/advances` stable; add `/salary-advances/*` web aliases.

**Spec:** `docs/superpowers/specs/2026-07-25-salary-advance-design.md`  
**Locked decisions:** Net × 50%, Finance-first, Principal=Director ON, BCRE on payment, `salary_advance.*`, full EOM recovery, no consolidation.

---

## Phase 2 checklist

### P0 — Navigation IA
- [x] Top-level **Salary Advances** menu (permission-gated)
- [x] Remove duplicate Finance → Salary Advance child
- [x] Employee children: Dashboard, Apply, My Applications, My Advance History
- [x] Finance children: Certify / Approval / Payment / Recovery / Outstanding / Reconciliation / Register / Reports / Settings
- [x] Route aliases `/salary-advances/*` → reuse API `/finance/advances`

### P1 — Pages / features
- [x] Employee Dashboard (§25)
- [x] Finance Dashboard (§26)
- [x] Outstanding Advances (BCRE balance > 0)
- [x] Salary Advance Register
- [x] Reconciliation Queue + resolve API/model
- [x] Workflow tracker improvements on detail
- [x] My Advance History

### P2 — Settings & reports
- [x] Policy Settings UI (read + new version; no silent override; audit)
- [x] SA reports pack (register / outstanding / by status / recovery) + CSV
- [x] Management metrics folded into Finance dashboard

### P3 — stubs only
- [x] Personnel file PDF reference stub when closed
- [x] Payroll integration stub (manual default)
- [ ] Consolidation / parallel advances — **NOT enabled**

---

## API additions (Phase 2)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/finance/advances/dashboard` | Queue counts + exposure totals |
| GET | `/finance/advances/employee-summary` | Eligibility + current + history snippet |
| GET | `/finance/advances/reconciliations` | Open recon records |
| POST | `/finance/advances/{id}/reconciliations/{recon}/resolve` | Resolve with notes |
| GET | `/finance/advances/policies` | List versions |
| POST | `/finance/advances/policies` | Activate new version (deactivates prior) |
| queue= | `outstanding`, `reconciliation`, `register`, `pending_approval`, `history` | Expand index filters |

---

## Explicitly deferred
- Full payroll vendor adapter
- Controlled policy-exception entity UI
- Opening-balance / historical migration tooling
- Enabling consolidation / instalments
