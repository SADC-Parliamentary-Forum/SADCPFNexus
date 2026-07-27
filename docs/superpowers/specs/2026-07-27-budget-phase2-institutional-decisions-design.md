# Budget Phase 2 Slice A2 — Institutional Decision Records

**System:** SADC PF Nexus  
**Module:** Budget Management & Budgetary Control  
**Slice:** Phase 2 A2 — FSC / EXCO / Plenary decision records (before lock)  
**Date:** 2026-07-27  
**Status:** Approved for implementation (Approach 1)

---

## Decisions locked

| Topic | Choice |
|-------|--------|
| Order vs lock | After SG approve, before lock: FSC → EXCO → Plenary |
| Record shape | Structured decision + optional attachment (no live voting) |
| Who records | Finance Controller / finance.admin **or** Governance Officer |
| Non-approved | Return cycle to `finance_review`; no inline line edits in A2 |
| Architecture | Extend cycle stage machine + `budget_cycle_decisions` |
| Next | Slice B — transfers / revisions / supplementary / contingency |

---

## Architecture

### Stage machine (after A1)

```
… → management_review → sg_approved
  → fsc_review → exco_review → plenary_review → plenary_approved → active
```

- `sgApprove` leaves cycle in `fsc_review` (SG done; institutional path starts).
- Approved FSC → `exco_review`; approved EXCO → `plenary_review`; approved Plenary → `plenary_approved`.
- `approved_with_amendments` | `deferred` | `rejected` → `finance_review` with reason.
- Lock only from `plenary_approved` (Finance Controller).

### Services

- `BudgetInstitutionalDecisionService` — record decision, advance or return
- `BudgetCycleService` — lock precondition; SG → fsc_review
- `BudgetActivationService` — unchanged activation; called only when lock allowed

### Data: `budget_cycle_decisions`

- budget_cycle_id, body (`fsc|exco|plenary`)
- meeting_on, decision, minute_reference, comments
- attachment_path nullable
- recorded_by, recorded_at
- Full history retained; current body stage uses latest record for that body on this cycle visit

### APIs

- `POST /budget/cycles/{id}/decisions`
- `GET /budget/cycles/{id}/decisions`
- Lock still `POST /budget/cycles/{id}/lock`

### Web

- Cycle detail: institutional decision panels for FSC/EXCO/Plenary
- Lock enabled only when status is `plenary_approved`

### Out of scope

- Live voting, Governance meeting entity link, inline amendment amounts (Slice B)
