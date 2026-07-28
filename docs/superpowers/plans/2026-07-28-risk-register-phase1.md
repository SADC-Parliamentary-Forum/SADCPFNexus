# Risk Register Phase 1 — Implementation Plan

**Date:** 2026-07-28  
**Branch:** `feat/risk-register-phase1`  
**PRD:** `docs/superpowers/specs/2026-07-28-risk-register-prd.md`

## Done

1. PRD + gap analysis + design saved under `docs/superpowers/specs/`
2. Migration `2026_07_28_210000_risk_register_phase1_extensions.php` (+ grants)
3. Models: assessments, controls, appetite, acceptances, incidents; Risk/RiskAction extended
4. Services: assessment (no % formula), appetite versions, acceptance SoD, action→Assignment, materialise
5. API routes for Phase 1 extensions + weekly `create-risk` from emerging risks
6. Web: create form fields, controls/incidents/appetite pages, Phase 2/3 nav stubs
7. PHPUnit: `RiskRegisterPhase1Test` covering §130 rules; workflow helper updated for objective/owner

## Verify

```bash
cd api && php artisan test --filter=Risk
```

## Not in this pass (deferred)

- Automated KRIs, control-testing campaigns, AI, insurance/BCP depth (nav stubs only)
- Rich objective picker UI (ID field for Phase 1)
- Full export ACL hardening beyond list/search/dashboard filters
