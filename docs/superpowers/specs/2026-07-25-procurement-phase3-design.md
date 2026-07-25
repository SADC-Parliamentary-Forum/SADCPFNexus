# Procurement Phase 3 — Design

**Date:** 2026-07-25  
**Status:** Locked — implement after Phase 2 live at `c8fc415`  
**PRD:** §79 Phase 3 + deferred items from Phase 2 design  
**System:** SADC PF Nexus  
**Branch:** `feat/procurement-phase3-2026-07-25`  
**Strategy:** Extend existing Procurement module. Phase 1/2 locks remain.

---

## Assumptions / Decisions (Locked)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Phase 1/2 locks** | Thresholds ≤10k / ≤100k / >100k for `sadc_pf_core`; budget hard-gate; derived stars; sealed bids; hard split — **unchanged**. |
| 2 | **Salary Advance** | Untouched. |
| 3 | **AI comparison** | Optional assistive text only. Feature-flag / settings gated. **NEVER** auto-award or auto-recommend without human action. Safe stub when no AI provider configured (deterministic placeholder from scores). |
| 4 | **Public notice board** | Public list of published tenders/RFQ notices. No competitor bid/quote amounts, vendor rankings, or sealed data. |
| 5 | **Policy Engine UI** | Full CRUD for multi-donor policy profiles (thresholds + donor applicability). Active profile drives effective settings / snapshots. Default `sadc_pf_core` preserves Phase 1 bands. |
| 6 | **Two-envelope UX** | Richer technical-first scoring UI using existing weights + `technical_score` / `financial_score`. Financial scores/amounts remain redacted while sealed. |
| 7 | **Mobile parity** | Deferred (document only) unless a trivial win appears. |

---

## Approaches

### A — Docs-only deferral again
Rejected — Phase 2 already deferred this pack; user Proceed after Phase 2 go-live.

### B — Coherent Phase 3 slice (recommended)
Ship API + admin web UI for AI stub summaries, public notices, policy profiles, and two-envelope scoring UX without rewriting award/seal core.

### C — Live LLM provider + newspaper automation
Out of scope — stub provider only; no external AI keys required to ship.

---

## Domain model (additions)

```
procurement_policy_profiles
  tenant_id, key, name, description
  donor_codes[] (json)
  direct_purchase_limit, quotation_limit, tender_threshold
  minimum_quotes_required, split_lookback_days, split_enforcement
  is_active, is_default

procurement_quotes.financial_score (nullable decimal)

tenant.settings.procurement:
  + policy_profile_key (active)
  + ai_comparison_enabled (bool, default false)
  + multi_donor_policy_ui = 'enabled' (was stub)
```

---

## API surface

| Area | Endpoints |
|------|-----------|
| Policy profiles | `GET/POST /procurement/policy-profiles`, `GET/PUT/DELETE .../{id}`, `POST .../{id}/activate` |
| Settings | existing + `ai_comparison_enabled`; `policy_profile_key` writable; `multi_donor_policy_ui=enabled` |
| Public notices | `GET /procurement/notices` (unauthenticated, throttled) — published tenders only, public fields |
| Auth notices | `GET /procurement/notice-board` (staff) — same public fields + internal refs |
| Comparison | `POST /procurement/tenders/{id}/comparison-summary` — returns assistive text; 403/422 if flag off or sealed-only incomplete |
| Assess | extend quote assess with optional `technical_score`, `financial_score` (financial rejected while sealed) |

---

## Security / SoD

- Public notices: title, reference, deadline, notice text, status=published only. **No** quotes, amounts, scores, vendors.
- AI summary: requires `ai_comparison_enabled`; response always includes `disclaimer` and `is_recommendation: false`. Does not set `is_recommended` or award.
- Policy profile activate/mutate: `procurement.admin` or System Admin.
- Sealed financial redaction unchanged.

---

## Testing

Feature tests: policy CRUD + activate + snapshot key; notices public omit bids; AI flag gate + stub text; assess technical-first + sealed financial block; Phase 1 threshold config still 10k/100k.

---

## Explicitly deferred

- Live LLM / forecasting / auto-award  
- Newspaper notice automation  
- Mobile parity for Phase 2/3 screens  

---

## Spec self-review

- No TBD for ship locks.  
- AI cannot award.  
- Default profile bands match Phase 1.  
- Public board has no competitor data.
