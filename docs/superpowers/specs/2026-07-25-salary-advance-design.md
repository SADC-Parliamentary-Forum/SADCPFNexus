# Salary Advance Module — Design

**Date:** 2026-07-25  
**Status:** Approved — Scope B Phase 1 complete; Phase 2 in progress (2026-07-25)  
**PRD:** Full Updated Product Requirements Document (user-supplied, 2026-07-25)  
**System:** SADC PF Nexus  
**Recommended delivery:** **Scope B** (policy-correct MVP closing demo gaps)

---

## Assumptions / Decisions (locked 2026-07-25)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Salary basis (50% calc)** | Production v1 uses **confirmed / applicable monthly net salary** (`salary_basis = net_confirmed`). Snapshot that net value on submit (and confirm on Finance certify). Gross/basic remain **future policy-config options only** — not active in v1. Where docs say “applicable monthly salary,” interpret as **confirmed net** for v1. |
| 2 | **Workflow first step** | **Finance-first.** Drop Supervisor. Employee submit → Finance certify → … |
| 3 | **Principal / Senior Admin** | **Retain** Principal/Senior Admin review in production workflow. Configurable via `admin_review_required`, **ON by default**. Path: Finance certify → Principal (Director) review → SG final approval. **Locked:** Principal maps to the existing **Director** Spatie role — do **not** create a separate Principal Officer role for Phase 1. |
| 4 | **BCRE register timing** | Create register / financial liability on **payment**, not on approve. |
| 5 | **Scope** | Implement **Scope B Phase 1** now. |
| 6 | **Permissions** | Separate **`salary_advance.*`** permissions (do not only reuse `finance.*`). Migrate/seed roles; keep backward-compatible fallbacks to `finance.*` where needed, but new module auth uses `salary_advance.*`. |

---

## Decisions (brainstorm + locked)

| Decision | Choice |
|----------|--------|
| Delivery ambition | **B** — close production/demo gaps in phases; not design-only (A), not full PRD in one stream (C) |
| Backend strategy | **Extend** existing `/finance/advances` + `SalaryAdvanceRequest` + BCRE; do **not** greenfield a parallel module |
| API surface | Keep `/api/v1/finance/advances/*`; add lifecycle endpoints; optional alias later |
| Ledger / transactions | **Reuse BCRE** (`BalanceRegister` + `BalanceTransaction`) as the authoritative SA ledger |
| Policy versioning | New `salary_advance_policy_versions` table; snapshot on submit/approve |
| Current policy mode | **One active advance only**; full recovery in the applicable payroll month; consolidation/instalments **disabled** |
| 50% basis | **`net_confirmed`** for v1 (locked). Policy column remains configurable for future gross/basic modes only. |
| Workflow | Submit → **Finance certify** → **Principal (ON by default)** → **SG approve** → Payment → Recovery → Close |
| FORM-002 | DomPDF Blade view (same stack as Programmes/SAAM) |
| Permissions | Dedicated `salary_advance.*` in Phase 1 |
| Out of Scope B Phase 1 | Full payroll system integration, consolidation modes, historical migration tooling, personnel-file deep link, Management aggregate dashboard polish |

---

## 1. Approaches considered

### A — Design + phased plan only
Docs only; no code. Useful for governance, but does not close demo/production gaps.

### B — Policy-correct MVP in phases (recommended)
Extend the existing finance advances core. Phase 1 closes the demo gaps that break trust (eligibility visibility, outstanding block by balance, formal Finance certify, payment + recovery recording, ledger transparency, employee workflow visibility, FORM-002 PDF). Later phases add queues polish, reconciliation UX, reports, policy admin UI, payroll adapters.

**Why B:** Substantial code already exists (CRUD, workflow, eligibility snapshot, BCRE on approve, HTML certificate, mobile request). Greenfield would duplicate BCRE/workflow/auth patterns. Full PRD (C) is too large for one stream and includes future policy modes that must stay disabled.

### C — Full PRD in one stream
All statuses, queues, dashboards, reconciliation, personnel file, migration, every report, every future policy mode scaffolded. High risk of unfinished half-features and policy-mode leakage.

---

## 2. What already exists vs PRD gaps

### Exists (keep / harden)

| Capability | Location |
|------------|----------|
| Draft/CRUD/submit/withdraw/return/resubmit | `SalaryAdvanceController`, web `/finance/advances` |
| Eligibility endpoint (50% of **confirmed net**) | `GET .../eligibility` — **aligns with locked v1 basis** |
| Block second advance when `status=approved` | `submit()` — must extend to BCRE balance + active statuses |
| Workflow: Supervisor → Finance Controller → SG | `WorkflowSeeder` — **replace** with Finance-first + Principal + SG |
| BCRE register on approve + txn types disbursement/recovery/adjustment/write_off | `BalanceRegisterService` — **move register creation to payment** |
| HTML approval certificate | `.../certificate` |
| Reports CSV/list | `ReportsController::salaryAdvances` |
| Mobile request + offline draft | `mobile/lib/features/salary_advance` |
| Shared finance permissions | `finance.view|create|approve|export|admin` — **add `salary_advance.*`** |

### Gaps Scope B must close

| Gap | Severity |
|-----|----------|
| Eligibility UI does not clearly show outstanding / pending recovery / reconciliation | Demo §4.1 |
| Cap uses **net × 50%**; lock as `net_confirmed` policy basis (gross/basic future-only) | Policy §9–10 |
| Outstanding block checks `status=approved` only — not BCRE balance, unpaid approved, paid unrecovered | Policy §16 |
| **Multi-month repayment** in UI/API (default 6–12 months) conflicts with current policy (**full EOM recovery**) | Policy §2, §21 |
| Finance is a workflow “approve” step, not formal **certify** with FORM-002 Part B fields | §13 |
| No explicit **deduction authority** persistence (UI checkbox only) | §12 |
| No **payment** / `paid` lifecycle; liability active at approve via BCRE | §20 |
| Recovery is manual BCRE txn only — no SA payment/recovery queues or employee-facing recovery status | §21–23 |
| No **policy_versions** table (stub fields in `$fillable` without migration) | §33–34 |
| No **FORM-002 PDF** (HTML cert only) | §31 |
| `index`/`show` requester-scoped — Finance cannot queue-list via advances API | Ops |
| Notification URL `/finance/salary-advance/{id}` wrong vs `/finance/advances/{id}` | Bug |
| Dedicated `salary_advance.*` permissions missing | §6, §46 — **in Phase 1** |

---

## 3. Architecture

### Ownership

- **Salary Advance** owns the application lifecycle, Finance certification, deduction authority, payment recording, recovery scheduling/recording (manual until payroll adapter), FORM-002 PDF, and employee/finance SA UX.
- **BCRE** owns the **authoritative balance ledger** for salary advances (and imprest). SA never stores an independently editable “outstanding” field.
- **WorkflowService** owns multi-step approval routing **after** Finance certification (Principal → SG when `admin_review_required`).
- **Policy engine (SA-specific)** owns versioned rules; runtime never invents percentages or concurrent-advance limits.

### Extend vs replace

```
Keep:  salary_advance_requests, /finance/advances, WorkflowService, BCRE
Add:   policy_versions, finance_reviews, deduction_authority columns,
       payment/recovery SA endpoints wrapping BCRE txns,
       FORM-002 PDF, finance queue list endpoints, status extensions,
       salary_advance.* permissions
Defer: greenfield /salary-advances resource rename, payroll vendor API,
       consolidation mode, personnel-file module wiring
```

### Event flow (current policy — locked)

```
Draft
  → employee confirms deduction authority
  → submit (server recheck: policy, net salary snapshot, exposure=0, no conflicting active app)
  → Pending Finance Certification
  → Finance Certify | Return | Not Eligible
  → Principal / Senior Admin review (ON by default; Director role)
  → SG Approve | Approve lower | Reject | Return
  → Approved for Payment
  → Finance records payment  →  BCRE disbursement txn + status Paid
  → Recovery scheduled (full amount, applicable payroll month)
  → Finance/Payroll records recovery  →  BCRE recovery txn
  → balance=0 → Recovered → Closed
```

BCRE register creation is on **payment** so “approved ≠ owing.”

### Hard rules

1. Nexus implements policy; it does not create policy. Future modes stay disabled until an authorised policy version activates them.
2. Outstanding balance = derived from BCRE transactions only.
3. No ordinary UI “override” for outstanding-advance or 50% rules; exceptions use a controlled exception record (Phase 2+).
4. Applicant cannot certify or final-approve own request.
5. System Admin cannot business-approve / certify / record payment without finance/approver permissions (or corresponding `salary_advance.*`).
6. All eligibility/exposure checks enforced server-side with transactional locks on submit and approve.
7. Historical applications keep their policy_version and salary snapshots forever.
8. v1 max eligible = `policy.max_salary_percentage` × **confirmed net** (snapshot).

---

## 4. Scope map

### Scope B — Phase 1 (approved for implementation)

Closes demo gaps + policy-critical path:

1. **Policy version seed** — v1.0: 50%, concurrent=1, full_repayment_required, recovery=`full_eom`, salary_basis=`net_confirmed`, final_approver=SG, finance_certify_required=true, **admin_review_required=true**.
2. **Eligibility enrichment** — return outstanding advance summary, exposure reasons, max from policy×net, payroll recovery context.
3. **Exposure blocking** — block when any BCRE SA balance > 0 **or** any advance in active non-closed statuses.
4. **Deduction authority** — persist declaration version, confirmed_at, user_id; require on submit.
5. **Finance certify API + UI** — Part B fields; certify / return / not_eligible; SoD checks.
6. **Workflow realign** — Finance certify gate, then Principal → SG (Principal ON by default).
7. **Payment recording** — `record-payment`; status `paid`; create/update BCRE + disbursement txn.
8. **Recovery schedule + record** — full amount; `schedule-recovery` / `record-recovery`; close when balance 0.
9. **Employee transparency** — detail page shows stage, current holder, payment/recovery/balance (from BCRE).
10. **FORM-002 PDF** — DomPDF Parts A–C + workflow + policy version.
11. **Fix** notification deep links; finance list endpoint for queues (certify / payment / recovery).
12. **`salary_advance.*` permissions** — seed + migrate roles; controller auth uses them (with finance.* fallback).
13. **Tests** — calculation, block rules, certify SoD, payment/recovery ledger, PDF auth, IDOR.

### Scope B — Phase 2 (implementing now — audit close-out)

See plan: `docs/superpowers/plans/2026-07-25-salary-advance-phase2.md`

- Top-level Salary Advances nav IA (§5) with `/salary-advances/*` aliases
- Employee + Finance dashboards
- Outstanding / Register / Reconciliation queues + recon resolve
- Policy admin UI (new version only; audit; no silent override)
- Expanded SA reports (register, outstanding, by status, recovery) + CSV
- Workflow tracker polish; My Advance History
- P3 stubs: personnel-file PDF reference, payroll integration interface (manual default)

### Scope B — Phase 3 / later

- Automated payroll send/receive adapter (beyond stub)
- Future policy modes (instalments, consolidation, gross/basic salary basis) behind version flags
- Termination clearance integration
- Controlled policy-exception entity
- Opening-balance / historical migration tooling

### Explicitly not in Scope B Phase 1–2

- Enabling consolidation / parallel advances / instalment UI
- Replacing BCRE with a SA-only ledger
- Full payroll vendor API go-live

---

## 5. Data model

### 5.1 Extend `salary_advance_requests`

Additive columns (keep table name):

| Column | Purpose |
|--------|---------|
| `policy_version_id` | FK snapshot |
| `salary_basis` | v1: `net_confirmed` (gross/basic reserved) |
| `approved_amount` | May differ from requested if SG approves lower |
| `deduction_authority_confirmed` | bool |
| `deduction_authority_version` | string |
| `deduction_authority_confirmed_at` | datetime |
| `intended_recovery_payroll_date` | date |
| `finance_certified_at` / `finance_certified_by` | certify audit |
| `not_eligible_reason` | when marked not eligible |
| `payment_status` | `not_prepared`…`paid`… |
| `paid_at` / `payment_reference` / `payment_method` | payment |
| `recovery_status` | `not_scheduled`…`recovered`… |
| `recovered_amount` | cached display; ledger authoritative |
| `closed_at` | closure |

**Status values (Phase 1 set):**  
`draft`, `submitted`, `finance_returned`, `finance_certified`, `not_eligible`, `returned_for_correction`, `approved`, `rejected`, `approved_for_payment`, `paid`, `recovery_scheduled`, `recovered`, `reconciliation_required`, `closed`, `withdrawn`, `cancelled`, `resubmitted`.

**Deprecate for current policy:** treating `repayment_months` as multi-instalment. Under v1 policy, force `repayment_months = 1` (full EOM recovery). Keep column for future instalment mode.

**Stub WS2 fillable fields** (`is_consolidation`, `policy_mode`, etc.): do **not** migrate/enable in Phase 1; leave unused.

### 5.2 `salary_advance_policy_versions`

As PRD §40. Seed one active row: `salary_basis=net_confirmed`, `admin_review_required=true`, `recovery_rule=full_eom`.

### 5.3 `salary_advance_finance_reviews`

One (or versioned) review row per application capturing Part B certification worksheet. Immutable after certify except via return + new review on resubmit.

### 5.4 Ledger = BCRE

Do **not** create `salary_advance_transactions` in Phase 1.

| PRD txn type | BCRE mapping |
|--------------|--------------|
| Advance Paid | `disbursement` |
| Payroll Deduction / Recovery | `recovery` |
| Recovery Adjustment / Reversal | `adjustment` |
| Write-Off | `write_off` |

Outstanding:

```
balance = disbursements − recoveries ± adjustments − write_offs
```

**Register timing:** Create BCRE register when payment is recorded (disbursement). Until paid, exposure for blocking uses SA status ∈ {approved, approved_for_payment, paid, recovery_scheduled, …} OR any open register balance > 0.

### 5.5 Reconciliations

Table designed in Phase 1 schema optional; **UI/API in Phase 2**. Phase 1 may set `reconciliation_required` status when recorded recovery < expected.

---

## 6. API (Phase 1)

Keep prefix `/api/v1/finance/advances`.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/eligibility` | Enriched exposure + policy max (net × %) |
| GET | `/` | Employee: own. Finance (`salary_advance.view` / certify): queue filters |
| POST/GET/PUT/DELETE | existing | Harden rules |
| POST | `/{id}/submit` | Require deduction authority; lock + recheck |
| POST | `/{id}/finance-certify` | Body: salary, basis, payroll date, eligible, comments |
| POST | `/{id}/finance-return` | |
| POST | `/{id}/mark-not-eligible` | |
| POST | `/{id}/approve` | Workflow Principal/SG; support `approved_amount` lower |
| POST | `/{id}/reject` / `return` / `withdraw` / `resubmit` | Existing |
| POST | `/{id}/record-payment` | Creates BCRE + disbursement |
| POST | `/{id}/schedule-recovery` | Sets recovery schedule fields |
| POST | `/{id}/record-recovery` | BCRE recovery txn; close if zero |
| POST | `/{id}/close` | Only if balance 0 |
| GET | `/{id}/ledger` | Register + transactions |
| GET | `/{id}/pdf` | FORM-002 DomPDF download |
| GET | `/{id}/certificate` | Keep HTML cert for now |

Auth: prefer `salary_advance.*`; fall back to equivalent `finance.*` for backward compatibility.

---

## 7. Workflow & SoD

### Production default (policy v1 — locked)

1. Employee submits (deduction authority required).  
2. Finance certifies (dedicated action — **not** interchangeable with SG approve).  
3. Principal / Senior Admin review **ON** by default (`admin_review_required=true`) — seeded as existing **Director** role (**no** new Principal Officer role).  
4. Secretary General final approval.  
5. Payment → Recovery → Close (Finance permissions: `salary_advance.pay` / `salary_advance.recover`).

### Changes from current seeder

Current: Supervisor → Finance Controller → SG.

Phase 1:

- Drop Supervisor.
- Finance certification is **outside** generic approve; on certify success, initiate workflow: **Director → SG**.
- If `admin_review_required=false` (future), workflow is SG-only after certify.

### SoD

- Requester ≠ certifier ≠ final approver (unless formal delegation recorded).
- Payment recorder should not be the final approver when both act on same advance (Phase 1: soft block with audit if same user).

---

## 8. Frontend (Phase 1)

### Employee

- Enhance `/finance/advances` dashboard: eligibility card, outstanding banner, current request tracker.
- Create wizard: remove multi-month instalment schedule under v1; show single recovery payroll month; persist deduction authority.
- Detail: workflow tracker, payment/recovery/balance, PDF download.

### Finance

- Queues: Pending Certification, Approved for Payment, Payroll Recovery (tabs with `queue=`).
- Certify form (Part B).
- Record payment / record recovery forms.

### Nav

Keep under Finance → Salary Advance for Phase 1.

### Mobile

Phase 1: align deduction authority + eligibility messaging; payment/recovery remain web/Finance-first.

---

## 9. FORM-002 PDF

- Blade: `resources/views/pdf/salary_advance_form_002.blade.php`
- DomPDF via existing Barryvdh package
- Parts A/B/C + reference, policy version, payment/recovery status, workflow history
- Authorisation: same as certificate (owner, salary_advance viewers, approvers, auditor roles)

---

## 10. Security & confidentiality

- Record-level auth on all show/ledger/pdf/payment endpoints.
- Salary fields omitted from notifications subject lines and from unauthorised list payloads.
- Mass-assignment: finance/payment fields not fillable via employee update.
- Concurrent submit: `lockForUpdate` on employee exposure query inside DB transaction.
- Sysadmin cannot certify/approve/pay without role/permission (regression tests).
- Module uses `salary_advance.*` permissions.

---

## 11. Testing strategy (Phase 1)

Backend feature tests (extend `SalaryAdvanceTest` + new lifecycle tests):

- Policy max calculation (net × 50%) + snapshot immutability
- Outstanding balance block (BCRE > 0)
- Approved-unpaid and paid-unrecovered blocks
- Duplicate active application block + race
- Deduction authority required
- Finance certify SoD + Part B persistence
- SG lower amount within policy
- Payment → ledger balance = amount (no register before payment)
- Recovery → balance 0 → close; new advance allowed
- Partial recovery → reconciliation_required
- PDF authorised/forbidden
- Peer IDOR on show/ledger/pdf
- `salary_advance.*` permission gates

Web: eligibility banner, wizard without instalments, certify form smoke.

---

## 12. Open questions — RESOLVED

1. **Salary basis:** **net_confirmed** (locked). Gross/basic = future config only.  
2. **Workflow first step:** Finance-first; drop Supervisor.  
3. **Principal step:** **ON by default** (`admin_review_required=true`).  
4. **Register timing:** **Create BCRE on payment**.  
5. **Scope:** **B Phase 1** approved.  
6. **Permissions:** Introduce **`salary_advance.*`** immediately.

---

## 13. Spec self-review notes

- No TBD placeholders left unresolved without an explicit default.
- Phase 1 scope is one implementation plan; Phase 2/3 deferred clearly.
- Multi-month repayment vs full EOM: **explicit policy fix** called out (critical).
- Ledger: single authority (BCRE) — no dual-ledger ambiguity.
- Consolidation: architecture-ready via future policy version only; disabled now.
- Net vs gross ambiguity: **locked to confirmed net for v1**.

---

## 14. Approval gate

**Approved** 2026-07-25 with locked decisions in Assumptions / Decisions above.

**Implementation plan:** `docs/superpowers/plans/2026-07-25-salary-advance-phase1.md`
