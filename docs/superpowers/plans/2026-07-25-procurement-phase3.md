# Procurement Phase 3 Implementation Plan

**Goal:** Ship PRD §79 Phase 3 deferred pack after Phase 2 (`c8fc415`).  
**Spec:** `docs/superpowers/specs/2026-07-25-procurement-phase3-design.md`  
**Branch:** `feat/procurement-phase3-2026-07-25`  
**Locked:** Phase 1/2 thresholds/budget/stars/sealed/hard-split; no Salary Advance; no auto-award.

---

## Task 1: Schema + config

- Migration `2026_07_26_200001_create_procurement_phase3_tables.php`
  - `procurement_policy_profiles`
  - `procurement_quotes.financial_score`
  - GRANT for app_user
- `config/procurement.php`: `ai_comparison_enabled` => false, `ai_comparison_provider` => stub

## Task 2: Policy Engine (TDD)

- Model + `ProcurementPolicyProfileService`
- Controller/routes CRUD + activate
- Wire `ProcurementSettingsService::effective` to active profile
- Wire `policySnapshot` / method suggestion to effective profile when tenant known
- Settings UI: list/create/activate profiles + donor codes

## Task 3: Public notice board (TDD)

- Public `GET /procurement/notices`
- Staff `GET /procurement/notice-board`
- Web: `/tender-notices` (public) + `/procurement/notices` (staff nav)
- Add public path to `web/proxy.ts`

## Task 4: AI comparison summaries (TDD)

- `ComparisonSummaryService` deterministic stub from technical/financial scores + weights
- `POST tenders/{id}/comparison-summary`
- Flag via settings/config; disclaimer always present; never mutates award fields
- UI on tender detail / evaluations when enabled

## Task 5: Two-envelope scoring UX (TDD)

- Assess accepts `technical_score` / `financial_score`
- Block financial_score while tender sealed
- Tender detail: weights, min technical, score table with sealed redaction, combined score when open

## Task 6: Docs + mobile deferral note

- Spec/plan under `docs/superpowers/`
- Note mobile parity deferred in plan completion

## Task 7: Verify, commit, merge, deploy

```bash
cd api && php artisan test tests/Feature/Procurement
```

Push → merge main → deploy `sadcpf-nexus-prod` → `/up`.

---

## Completion / deferrals

**Mobile parity:** Deferred — no quick wins identified for Phase 2/3 screens in this slice; document for a later mobile sprint.

**Also deferred:** Live LLM provider, forecasting, auto-award, newspaper notice automation.
