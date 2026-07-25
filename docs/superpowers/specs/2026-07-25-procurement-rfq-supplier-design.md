# Procurement / RFQ / Supplier Management — Design

**Date:** 2026-07-25  
**Status:** Locked 2026-07-25 — user Proceed  
**PRD:** Full Updated Product Requirements Document (user-supplied, §§1–81, 2026-07-25)  
**System:** SADC PF Nexus  
**Recommended delivery:** **Scope B** — PRD §79 Phase 1 mandatory pack; extend existing module (do not rewrite)

**Approval:** User said **Proceed** on 2026-07-25 with recommended defaults (thresholds 10k/100k, budget hard-gate, derived stars, GRN→draft FA/Stock, Scope B extend, COI + soft split warning, nav children). Salary Advance remains untouched.

---

## Assumptions / Decisions (Locked 2026-07-25 — user Proceed)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Delivery scope** | **Scope B** = PRD §79 **Phase 1 — Mandatory** only for this stream. Phase 2/3 documented as deferred slots. |
| 2 | **Backend strategy** | **Extend** existing `api/app/Modules/Procurement`, models, routes, web `/procurement/*`, supplier portal. **No greenfield** parallel module. |
| 3 | **Salary Advance** | **Do not touch** Salary Advance files, nav, or permissions (parallel stream). |
| 4 | **Thresholds** | Align live defaults with domain policy reference: **direct ≤ N$10,000**; **RFQ/quotations N$10,001–N$100,000**; **tender > N$100,000**. Replace current config defaults (`5k / 50k / 500k`). Keep values in `config/procurement.php` (+ env overrides). Full multi-donor **Policy Engine** profiles = Phase 2 lite; Phase 1 = single **SADC PF Core** profile snapshot fields on request. |
| 5 | **Budget confirmation** | **Hard gate** before RFQ issue and award. Wire existing `BudgetReservation` as Phase 1 “Confirmed” path. Map PRD statuses onto reservation + request status (see §D2). Finance does **not** write the authoritative budget ledger from Procurement (reservation record only). |
| 6 | **PIF → Procurement** | Backend `POST /programmes/{id}/send-to-procurement` already batches items → one `ProcurementRequest`. Phase 1 adds **UI** on PIF + Procurement Intake; supports subset selection (separate requests / lots via multiple transfers). |
| 7 | **Supplier ratings** | **Stars derived from structured scorecard only.** Keep/extend `VendorPerformanceEvaluation`; overall star display computed from weighted score. **Disable** free-form click-to-set overall stars (`VendorRating` as opinion score). Optional narrative comments remain on evaluations. |
| 8 | **FA / Stock handoff** | On GRN **accept**, offer/create **draft** Fixed Asset and/or Stock intake linked to PO/request — modules remain authoritative. No auto-capitalisation without officer confirmation. |
| 9 | **Evaluations / COI** | Phase 1: quote **compliance assessment** (exists) + **evaluator COI declaration** before assess/award + simple scored comparison fields. Formal **Tender Committee** / sealed two-envelope = **Phase 2**. |
| 10 | **Anti-splitting** | Phase 1: **warning + justification** on create/submit (same requester/dept/PIF/budget line/similar description within N days). Hard block = Phase 2. |
| 11 | **Navigation** | Keep top-level **Procurement** menu. **Extend** children to cover Phase 1 gaps; do not delete working routes. Map PRD §8 names as aliases/labels where helpful. |
| 12 | **Mobile** | Phase 1 web-first for gaps; mobile follow-up only if web path is blocked for a critical role. |

---

## 1. Approaches considered

### A — Design + phased plan only
Docs only. Useful for governance; does not close demo/production gaps.

### B — PRD Phase 1 mandatory pack on existing core (recommended)
Extend the production-grade pipeline already in Nexus (request → HOD → budget → approve → RFQ → quotes → award → PO → GRN → invoice/contract + supplier portal). Close honest gaps: PIF transfer UI, budget hard-gate + UI, threshold alignment, structured stars, COI declaration, basic split warning, GRN→FA/Stock draft handoff, nav/intake polish, reports/audit hardening.

**Why B:** Module is deep (services, feature tests, admin + supplier portal). Rewrite would duplicate auth, attachments, audit, and portal. Full PRD (C) includes tender portal, planning, catalogue, AI — too large for one stream and conflicts with §79 phasing.

### C — Full PRD §§1–81 in one stream
Every submenu, tender committee, policy engine multi-donor, planning, catalogue, AI summaries. High risk of unfinished half-features and regression on working RFQ/PO/portal paths.

---

## 2. What already exists vs PRD gaps

### 2.1 Exists (keep / harden)

| Capability | Evidence |
|------------|----------|
| Requisition CRUD, submit, HOD, approve, reject, return, withdraw, resubmit | `ProcurementService`, web `/procurement` |
| RFQ issue (categories + external email tokens), quotes, assessment, award → draft PO | `issueRfq`, `award`, RFQ pages |
| Vendors lifecycle, categories, blacklist/suspend | `VendorService`, `/procurement/vendors` |
| **Supplier self-registration** + portal (RFQs, POs, invoices, profile) | `/supplier/register`, `SupplierPortalController` — **Done** vs PRD §3.1 |
| External token RFQ | `/external-rfq/{token}` |
| PO issue/cancel, GRN record/accept/reject, invoices + 3-way match, contracts | Dedicated services/controllers |
| Budget **reservation API** (optional today) | `BudgetReservationService` — not hard-gated; **no UI** |
| PIF batch transfer **API** | `ProgrammeService::sendToProcurement` + tests — **no UI** |
| Performance evaluations (5 dimensions + overall %) | `VendorPerformanceEvaluation` |
| Opinion star ratings (click 1–5) | `VendorRating` — **conflicts with PRD §3.2 / §48** |
| Analytics page + APIs | `/procurement/analytics` |
| Feature tests across major flows | `api/tests/Feature/Procurement/*` |
| Sidebar Procurement children | Requests, RFQ, Vendors, POs, Receipts, Invoices, Contracts, Analytics, New Request |

### 2.2 Gap matrix (honest)

| PRD area | Status | Notes |
|----------|--------|-------|
| §3.1 Supplier self-registration | **Done** | Portal + approval gate |
| §3.2 Structured ratings → stars | **Partial** | Evals exist; free-form stars still settable; stars not derived from scorecard |
| §3.3–3.4 PIF transfer / batching | **Partial** | API Done; UI Missing; lots = multiple transfers |
| §3.5 FA / stock handoff | **Missing** | Stock FKs exist; Asset has no procurement FKs; GRN does not create drafts |
| §5–6 Policy engine / thresholds | **Partial** | Hardcoded config; defaults **disagree** with policy docs (5/50/500k vs 10/100k) |
| §7 Anti-splitting | **Missing** | |
| §8 Navigation richness | **Partial** | Own menu exists; missing Intake, Budget Confirmation, Supplier Applications, Performance, Register, Settings |
| §12 Budget confirmation | **Partial** | API only; not required before RFQ |
| §13–16 Method determination / override / sole source / emergency | **Partial** | `procurement_method` field + tender check at RFQ; no calculated method, override audit, sole-source pack |
| §17–21 Supplier register / verification / categories | **Mostly Done** | Price/rate catalogue updates thinner |
| §22–25 RFQ / quotations / sealed bid | **Partial** | RFQ Done; sealed bid confidentiality incomplete |
| §26–28 Tender / committee | **Missing** | Phase 2 |
| §29 COI | **Missing** | Phase 1 minimal declaration |
| §30–34 Evaluation / recommendation | **Partial** | Compliance assess; no formal committee scoring pack |
| §35–37 Award approval / unsuccessful notify | **Partial** | Award exists; separate award-approval step thin |
| §38–43 PO / contract / GRN / 3WM / AP | **Mostly Done** | Contract amendments thinner |
| §44–45 FA / Stock integration | **Missing** | |
| §46–49 Performance / stars / profile | **Partial** | See ratings gap |
| §50 Suspension | **Done** | |
| §51 Planning | **Missing** | Phase 2 |
| §52–54 Dashboards | **Partial** | Analytics exists; role dashboards thinner |
| §59–62 Register / reports / cycle / compliance | **Partial** | |
| §63 Approval authority engine | **Partial** | Permissions + workflow; not full matrix engine |
| §79 Phase 2–3 items | **Deferred** | By design |

### 2.3 Demo items (§3) — Phase 1 must close

1. Self-registration — **already Done** (verify UAT; no rewrite).  
2. Structured scorecard → derived stars — **must fix**.  
3. PIF transfer without retype — **UI must ship**.  
4. Batching / lots / separate requests — **UI + document multi-call pattern**.  
5. FA/stock trigger — **draft handoff on GRN accept**.

---

## 3. Navigation (§8) vs current sidebar

**Current** (`web/components/layout/Sidebar.tsx`):

| Current label | Route |
|---------------|-------|
| Requests | `/procurement` |
| Quotations (RFQ) | `/procurement/rfq` |
| Vendors | `/procurement/vendors` |
| Purchase Orders | `/procurement/purchase-orders` |
| Receipts | `/procurement/receipts` |
| Invoices | `/procurement/invoices` |
| Contracts | `/procurement/contracts` |
| Analytics | `/procurement/analytics` |
| New Request | `/procurement/create` |

**Phase 1 nav changes (extend, do not remove working items):**

| Add / rename | Route | Purpose |
|--------------|-------|---------|
| Dashboard | `/procurement/dashboard` *(or enhance Analytics)* | Role-filtered queues |
| Procurement Intake | `/procurement/intake` | PIF-originated + pending method |
| Pending Budget Confirmation | `/procurement/budget` | Finance reserve queue |
| Supplier Applications | `/procurement/vendors?status=pending_approval` *(filter)* | Pending self-reg |
| Supplier Performance | `/procurement/vendors` performance entry / tab deep-link | Scorecard |
| Procurement Register | `/procurement/register` | Exportable register |
| Settings | `/procurement/settings` | Thresholds (admin) |

PRD items **Tenders / Bid Submissions / Evaluations / Tender Committee / Planning** remain Phase 2 (hide or “Coming soon” only if needed to avoid 404s — prefer omit until built).

Supplier portal already has: Overview, RFQs, POs, Invoices, Profile — maps adequately to PRD external portal for Phase 1.

---

## 4. Architecture

```text
┌──────────────┐  send-to-procurement (batch)   ┌─────────────────────────────┐
│ PIF / Programme │ ──────────────────────────► │ ProcurementRequest (+ items) │
│ (approved)      │ ◄── link via programme_      │ status: draft → … → awarded  │
└──────────────┘     procurement_item FKs       └───────────┬─────────────────┘
                                                            │
                     ┌──────────────────────────────────────┼──────────────────┐
                     ▼                                      ▼                  ▼
            BudgetReservation                      RFQ / Quotes / Award      Policy snapshot
            (hard gate Phase 1)                    + COI declaration         (SADC PF Core)
                     │                                      │
                     ▼                                      ▼
                   Approve ──► issueRfq ──► assess ──► award ──► draft PO
                                                                  │
                                                                  ▼
                                                         GRN accept
                                                           │
                                              ┌────────────┴────────────┐
                                              ▼                         ▼
                                     Draft Asset (FA)            Draft / update Stock
                                     (officer confirms)          (officer confirms)
```

**Ownership:** Procurement owns solicitation → award → PO → GRN linkage. Budget module remains ledger authority (reservation is a procurement-side hold record). FA and Stock remain registers of record after handoff confirmation.

---

## 5. Phase 1 design units

### D1 — Threshold & method (lite policy)

- Update `config/procurement.php` defaults: `direct_purchase_limit=10000`, `quotation_limit=100000`, `tender_threshold=100000` (tender **above** quotation band; document edge at exactly 100000 as RFQ max / tender starts above — lock: **≤10k direct; ≤100k RFQ; >100k tender**).
- On approve / before RFQ: compute `suggested_method` from estimated value; persist `procurement_method`, `policy_profile_key=sadc_pf_core`, `policy_snapshot` JSON (thresholds + min quotes at decision time).
- Method override requires reason + actor + timestamp (columns or audit payload).

### D2 — Budget confirmation hard gate

- After HOD: status `hod_approved` → Finance uses existing reserve API → `budget_reserved`.
- Change `approve()` / `issueRfq()` / `award()` to require active (unreleased) reservation **or** explicit low-value exemption only if policy allows (Phase 1: **require reservation for all** above 0, or allow direct ≤ limit with Finance confirm still recorded — **lock: require budget confirmation record for all requests before procurement approve**).
- Web: Pending Budget Confirmation queue + actions on request detail.
- Map UI labels to PRD: Pending Finance / Confirmed / Insufficient / Returned (Returned = release + return-for-correction).

### D3 — PIF integration UI

- On approved PIF Budget & Procurement section: multi-select untransferred `ProgrammeProcurementItem`s → call `programmeApi.sendToProcurement`.
- Procurement Intake list: requests with PIF source / `description` containing programme ref; link back to programme.
- Batching: one transfer = one request (existing). Separate lots = multiple transfers with different item subsets. Document in UI copy.

### D4 — Structured performance → stars

- Extend evaluation criteria toward PRD §47 (add missing dimensions or map existing five + configurable weights in config).
- Compute `derived_star_rating` (1–5, half-stars OK) from overall score; display on vendor list/detail.
- Remove or gate UI that POSTs free-form `VendorRating` as overall stars; prefer evaluations only. Keep historical `VendorRating` rows read-only for audit if needed.
- Stars **cannot** be set directly.

### D5 — COI + evaluation hygiene

- Before quote assess and before award: require `coi_declared` / `coi_has_conflict` / `coi_notes` on actor for that request (table `procurement_coi_declarations` or columns on assessment action).
- Block award if any assessor declared unresolved conflict without recusal record.

### D6 — Anti-split warning (Phase 1)

- On submit: query recent requests (same tenant, requester or department or programme link, similar title/category, overlapping budget line, within configurable days, cumulative value crossing next threshold).
- Return `split_warnings[]`; require `split_justification` to proceed when flagged.

### D7 — GRN → FA / Stock draft handoff

- On GRN accept: if line flagged capital → create `Asset` drafts (`purchase_order_id` / `procurement_request_id` / `goods_receipt_note_id` FKs — add migration); if consumable → create/update `StockItem` + inbound transaction via `StockService`.
- Officer confirms category/qty on handoff dialog; never silent ledger pollution.

### D8 — Nav, register, settings, reports

- Sidebar Phase 1 children as in §3.
- Register export (CSV) of requests with method, supplier, value, status, PIF ref.
- Settings page: read/update threshold env-backed config for `procurement.admin` (or document ops via env if UI deferred — **lock: admin Settings UI for the three thresholds + min quotes**).

### D9 — Explicitly out of Phase 1

- Advanced tender portal, tender committee meetings, sealed two-envelope, contract milestone packs, procurement planning, catalogue, advanced split hard-blocks, AI comparison, forecasting, multi-donor full policy engine UI, mobile parity for new screens.

---

## 6. Data / API deltas (Phase 1 summary)

| Change | Notes |
|--------|-------|
| `config/procurement.php` defaults | 10k / 100k / 100k+ |
| `procurement_requests` | `policy_snapshot`, `suggested_method`, `method_override_*`, `split_justification`, source/programme refs if missing |
| `procurement_coi_declarations` | new |
| `assets` | nullable FKs to PO / procurement_request / GRN |
| `vendor` display | `derived_star_rating` accessor from evaluations |
| Harden `approve` / `issueRfq` / `award` | budget gate |
| GRN accept | optional handoff payload |
| Web | Intake, Budget queue, PIF send UI, Settings, Register, rating UX fix |

Idempotency: PIF transfer already 409s on re-link; preserve.

---

## 7. Security & SoD

- Preserve existing permission set; add only if needed: `procurement.manage_budget` (exists), ensure Finance roles have it for confirmation queue.
- Requester cannot approve/award own request (already partially enforced).
- Supplier portal users cannot access staff evaluation/COI endpoints.
- Attachment downloads remain permission-gated (prior security work).

---

## 8. Testing strategy (Phase 1)

- Backend feature tests: threshold suggestion; budget gate blocks RFQ; PIF UI covered by existing transfer tests + new web e2e smoke; derived stars; COI block; split warning; GRN handoff creates Asset/Stock draft.
- Do not regress: `RfqInitiationTest`, `ProcurementAwardTest`, `SupplierRegistrationTest`, `ProgrammeProcurementTransferTest`, `GoodsReceiptTest`.
- E2E: extend `web/tests/e2e/procurement.spec.ts` for budget gate + PIF send if fixtures allow.

---

## 9. Error handling

- 422 with field messages for gate failures (budget, COI, min quotes, method).
- 409 for duplicate PIF item transfer.
- Split warnings are soft (422 only if justification missing when flagged).

---

## 10. Spec self-review notes

- No TBD placeholders left for Phase 1 locks.  
- Phase 2/3 explicitly deferred — not half-specified as build tasks.  
- Threshold edge at N$100,000 locked as RFQ max / tender above.  
- Contradictions avoided: stars from scorecard only; budget reservation = Phase 1 confirmation mechanism.

---

## 11. Open questions (need user input only if disagreeing with locks)

1. Confirm threshold band edge: **≤10k direct / ≤100k RFQ / >100k tender** (vs keeping legacy 5/50/500k).  
2. Confirm budget gate: **all** requests need Finance confirmation before procurement approve (including ≤10k).  
3. Confirm free-form `VendorRating` clicks: **retire for overall stars** (read-only history OK).  
4. Confirm FA/Stock handoff in **this** Phase 1 stream (demo §3.5) vs defer stock/FA to a joint FA stream.

If no objection, treat locks in the Assumptions table as approved for implementation planning.

---

## 12. Suggested next step

1. User approves this spec (or adjusts open questions).  
2. Implement via `docs/superpowers/plans/2026-07-25-procurement-phase1.md` using subagent-driven-development / executing-plans.  
3. Do **not** start until Salary Advance parallel work is clear of shared nav conflicts (Procurement sidebar edits only under Procurement children).
