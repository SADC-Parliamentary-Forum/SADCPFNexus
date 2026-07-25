# Procurement Phase 2 — Design

**Date:** 2026-07-25  
**Status:** Locked — user Proceed after Phase 1 live at `f5eb79f`  
**PRD:** §79 Phase 2 + deferred items from Phase 1 design  
**System:** SADC PF Nexus  
**Strategy:** Extend existing Procurement module (no rewrite). Phase 1 locks remain.

---

## Assumptions / Decisions (Locked)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Phase 1 locks** | Thresholds ≤10k / ≤100k / >100k; budget hard-gate; derived stars; FA/Stock draft handoff; COI; soft-split foundation — **unchanged**. |
| 2 | **Salary Advance** | Untouched. |
| 3 | **AI awarding** | Phase 3 — not enabled. |
| 4 | **Tenders** | New `tenders` entity linked 1:1 to a tender-method `procurement_request`. Lifecycle: draft → published → closed → opened → evaluating → awarded/cancelled. Reuses quotes as bid submissions with sealed envelope fields. |
| 5 | **Sealed bids** | Financial amounts hidden from staff list/detail until `bids_opened_at`. Deadline locks submissions. Supplier may replace quote (version++) before deadline only. |
| 6 | **Tender Committee** | Standing or ad-hoc committee records; membership; quorum = ceil(n/2)+0 or configured min (≥3); meetings with minutes link (attachment or URL). Evaluation path requires quorum members present + COI (Phase 1). |
| 7 | **Hard split** | When split detected: require `split_justification` **and** Finance Controller / SG / System Admin **authorisation** before approve / issue-RFQ / publish tender. Soft-only mode remains configurable (`split_enforcement=soft\|hard`, default **hard**). |
| 8 | **Contract milestones** | Child rows on `contracts`: title, due_date, amount, status (pending/in_progress/completed/overdue), notes. |
| 9 | **Annual Procurement Plan** | CRUD for plan year + line items (description, estimated_value, method, quarter, status). Nav: Planning. |
| 10 | **Catalogue** | Per-vendor price/rate items with versioned history on change. Nav: Catalogue. |
| 11 | **Compliance reminders** | `attachments.expires_at` for vendor compliance docs; daily command notifies Procurement Officers when expiring ≤30 days or expired. |
| 12 | **Multi-donor policy UI** | Settings stub only (note + profile_key read-only). Full engine Phase 3. |
| 13 | **Nav** | Add: Tenders, Bid Submissions, Evaluations, Tender Committee, Planning, Catalogue. |

---

## Approaches

### A — Docs-only deferral
Rejected — user Proceed after Phase 1 go-live.

### B — Coherent Phase 2 slice on existing core (recommended)
Ship API + focused admin web UI for all ten scope items without rewriting RFQ/PO/GRN. Tender portal is staff-side lifecycle + sealed quote behaviour; supplier continues via existing portal with sealed/version rules.

### C — Full two-envelope UI + public advertisement portal
Deferred — needs public notice board and heavier UX; Phase 2 ships sealed financials + committee + evaluation gate instead.

---

## Domain model (additions)

```
tenders ──1:1── procurement_requests (method=tender)
   │
   ├── tender_committee_id (nullable)
   └── quotes (sealed financials until open)

tender_committees
   ├── members (user_id, role: chair|member|secretary)
   └── meetings (held_at, quorum_met, minutes_url / attachment)

contract_milestones ──N:1── contracts

annual_procurement_plans
   └── plan_items

vendor_catalogue_items
   └── vendor_catalogue_item_versions (history)

attachments.expires_at (vendor compliance)

procurement_requests.split_authorised_by / _at / _notes
procurement_quotes.version, supersedes_quote_id, technical_score, financial_visible_at
```

---

## API surface (Phase 2)

| Area | Endpoints |
|------|-----------|
| Tenders | `GET/POST /procurement/tenders`, `GET/PUT .../{id}`, `POST .../publish`, `POST .../close`, `POST .../open-bids`, `POST .../start-evaluation` |
| Bid submissions | `GET /procurement/bid-submissions` (quotes where method=tender or sealed); detail via request quotes with redaction |
| Evaluations | `GET /procurement/evaluations` (tenders in evaluating/opened); reuse COI + assess |
| Committees | `CRUD /procurement/tender-committees`, members, `POST .../meetings` |
| Planning | `CRUD /procurement/plans`, nested items |
| Catalogue | `CRUD /procurement/catalogue`, history `GET .../{id}/history` |
| Milestones | `CRUD /procurement/contracts/{id}/milestones`, `POST .../{mid}/complete` |
| Split | `POST /procurement/requests/{id}/authorise-split` |
| Settings | existing + `split_enforcement`; multi-donor stub fields read-only |

---

## Security / SoD

- Sealed amounts: redacted unless `bids_opened_at` set **or** caller is System Admin with audit (default: no bypass — even admin waits for open; open action audited).
- Split authorisation: Finance Controller / SG / System Admin only; not requester.
- Committee mutations: Procurement Officer+.
- Supplier portal: own quote only; versioned replace before deadline; no peer financials.

---

## Testing

Feature tests per area (sealed redaction, deadline lock, version replace, quorum, hard split block, plan CRUD, catalogue history, milestone complete, expiry command dry-run). Do not regress Phase 1 suite.

---

## Explicitly deferred (Phase 3 / later)

- AI comparison / awarding / forecasting  
- Public advertisement portal / newspaper notice automation  
- Full multi-donor Policy Engine UI  
- Mobile parity for Phase 2 screens  
- Two-envelope technical-first scoring UI polish beyond stored scores  

---

## Spec self-review

- No TBD for Phase 2 ship locks.  
- Phase 1 thresholds/budget/stars/handoff untouched.  
- Multi-donor is stub — not half-built engine.
