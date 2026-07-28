# Risk Register Phase 1 — Gap Analysis

**Date:** 2026-07-28  
**Baseline:** `SADCPFNexus/main` @ `993cb84` (existing Risk module phases 1–3 UI/API)  
**PRD:** `2026-07-28-risk-register-prd.md` §127 / §130  
**Branch:** `feat/risk-register-phase1`

## Scorecard

| Capability (Phase 1) | Before | After |
|---|---|---|
| Basic risk CRUD + workflow | HAD | KEPT / EXTENDED |
| Likelihood × impact score / level | HAD | KEPT (inherent) + versioned assessments |
| Residual fields on risk row | HAD (overwritable) | EXTENDED — assessment history rows; no % formula |
| Risk Owner + Action Owner | PARTIAL | EXTENDED — + Control Owner; IA blocked as owner |
| Objective linkage | MISSING | ADDED (required to leave draft) |
| Cause / event / consequence | MISSING | ADDED |
| Register scopes (enterprise/dept/project) | MISSING | ADDED |
| Control register | MISSING (effectiveness string only) | ADDED |
| Appetite / tolerance versioned | MISSING (hardcoded bands) | ADDED policy versions |
| Treatment → Assignments | MISSING (local risk_actions only) | ADDED idempotent from-source |
| Assignment complete ≠ auto residual | N/A | ENFORCED |
| Formal time-bound acceptance | MISSING | ADDED |
| High/critical acceptance SoD | MISSING | ADDED |
| Incidents distinct entity | MISSING | ADDED |
| Materialise without auto-close | MISSING | ADDED |
| Proposals / intake | MISSING | ADDED (`proposed` status) |
| Weekly escalate → risk | PARTIAL (decision create_risk raw) | EXTENDED (proposal + objective gates) |
| Confidentiality ACL | MISSING | ADDED |
| Dashboards / matrix / audit | HAD | EXTENDED (ACL + policy matrix) |
| Soft-delete drafts; retain closed | PARTIAL | ENFORCED (no hard-delete closed) |
| Automated KRIs / control campaigns / AI | N/A | Deferred (nav stubs) |

## Keep / extend (do not discard)

- `Risk`, `RiskAction`, `RiskHistory`, matrix, dashboard, policy library, attachments
- Workflow statuses and notifications
- Web pages under `/risk/*`
- Permissions `risk.view|create|submit|review|approve|manage|admin`

## Critical gaps closed this pass

1. Objective required before submit  
2. One Risk Owner; Control Owner distinct; IA cannot own  
3. Versioned inherent/residual assessments; no residual % formula  
4. Treatment → Assignment idempotent; reassessment flag on complete  
5. Formal acceptance with SoD for high/critical  
6. Materialise keeps risk open  
7. Confidentiality on list/search/dashboard  
8. Incidents separate; closed risks soft-retained  
