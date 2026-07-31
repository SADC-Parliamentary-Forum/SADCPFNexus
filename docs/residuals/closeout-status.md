# Residual Closeout Status

**Branch:** `feat/residual-closeout`  
**Baseline tip:** `SADCPFNexus/main` @ `62397d6` (Access Control Phase 7–8)  
**Worktree:** `.worktrees/residual-closeout`  
**Inventory date:** 2026-07-31

This document reconciles programme residuals and tracks closeout. Governance items stay **Pending** until institutional decisions are recorded in Admin UIs — code never invents policy or secrets.

---

## Classification legend

| Class | Meaning |
|---|---|
| **DO NOW** | Implementable product code |
| **GOVERNANCE PENDING** | Checklist / operator evidence only |
| **OUT OF SCOPE** | Explicitly excluded |

---

## Access Control (Phases 7–8 residuals)

| # | Item | Class | Status |
|---|---|---|---|
| AC-1 | Correspondence list/detail query scoping via `AccessScopeResolver` | DO NOW | **Closed** — party-only for staff; admin/confidential elevated |
| AC-2 | Risk list/detail/dashboard query scoping via `AccessScopeResolver` | DO NOW | **Closed** |
| AC-3 | Badge/count/dashboard filtering by effective permissions (no count leak) | DO NOW | **Closed** — `/api/v1/dashboard/stats` scoped |
| AC-4 | Unknown-route / unregistered permission deny-default (`canAccessRoute`) | DO NOW | **Closed** — deny unknown; expanded ROUTE_ACCESS |
| AC-5 | Admin↔PA dual-control — Access Admin cannot self-approve privileged grants; second approver | DO NOW | **Closed** — `PrivilegedAccessDualControlService` |
| AC-6 | SAAM `DelegatedAuthority` → PA `IdentityDelegation` collapse (one effective path) | DO NOW | **Closed** — `DelegationCollapseService` + `DelegationService` |
| AC-7 | Prefer Platform Audit Trail adapter for permission events (via `AuditLog::record` dual-write) | DO NOW | **Closed** — grant/deny/role/SoD paths use `AuditLog::record` |
| AC-8 | Pilot persona matrix operator sign-off evidence | GOVERNANCE PENDING | Tooling shipped; operator evidence still required |
| AC-9 | Freeze legacy role edits; migrate onto published versions | GOVERNANCE PENDING | Cutover API/checklist exist; operator-driven |
| AC-10 | Retire obsolete broad permissions after dual-run | GOVERNANCE PENDING | Dry-run helper exists; aliases remain |
| AC-11 | MFA / review cadence / break-glass / pen-test engagement | GOVERNANCE PENDING | Seeded at `/admin/access/governance` |
| AC-12 | Force privileged session refresh on role change | — | **Closed** earlier |
| AC-13 | Leave / attachment IDOR safe 404; seeder template merge | — | **Closed** earlier |
| AC-14 | Travel list scoping | — | **Closed** earlier |

---

## Platform Audit Trail Phase 2

| # | Item | Class | Status |
|---|---|---|---|
| AT-1 | Security monitoring rules (versioned) + evaluation for feasible high-value events | DO NOW | **Closed** |
| AT-2 | Security alert workflow (New → review → classify → close) | DO NOW | **Closed** |
| AT-3 | Forensic case + link events + evidence package (hashes/manifest) + chain-of-custody MVP | DO NOW | **Closed** |
| AT-4 | Forensic apply holds (reuse existing hold service) | DO NOW | **Closed** |
| AT-5 | Admin UI for alerts + forensic cases | DO NOW | **Closed** |
| AT-6 | Governance checklist updates (MVP shipped notes; SIEM/WORM/AI remain Pending) | DO NOW | **Closed** (status text only) |
| AT-7 | Live SIEM vendor integration | GOVERNANCE PENDING | No live SIEM without credentials |
| AT-8 | Immutable off-platform WORM archive | GOVERNANCE PENDING | |
| AT-9 | Anomaly / AI investigation assistants | GOVERNANCE PENDING | |
| AT-10 | Event retention periods, privacy notice, signing-key custody, etc. (§122) | GOVERNANCE PENDING | `/admin/audit-trail/governance` |

---

## Other module residuals

| # | Item | Class | Status |
|---|---|---|---|
| OT-1 | Offline stocktake queue auto-apply UI | OUT OF SCOPE (optional) | |
| OT-2 | Cashflow / scenario forecasting UX depth | OUT OF SCOPE (optional) | |
| OT-3 | Visual watermark transform | OUT OF SCOPE (optional) | |
| OT-4 | Prod IMAP / SMS / WhatsApp / AV / OCR / SharePoint / LLM credentials | GOVERNANCE PENDING | Null stubs remain |
| OT-5 | Document §125 / Notifications §124 checklist answers | GOVERNANCE PENDING | |
| OT-6 | FA ↔ Stock merge; bank GL; invented OT rates; paid GDS; pen-test firm | OUT OF SCOPE | |
| OT-7 | Mobile store secrets / live Play/ASC submit | OUT OF SCOPE | |
| OT-8 | Travel residuals | — | **Already done** |

---

## Impossible without institutional decisions / secrets

- MFA institutional policy and privileged access review cadences
- Break-glass emergency procedure approval
- Pen-test firm engagement / report
- Live SMS/WhatsApp, IMAP password, AV/OCR/SharePoint/LLM/SIEM credentials
- Retention periods, WORM archive platform, signing-key custody
- Approving any governance checklist row as Done without human decision
- FA/Stock merge and accounting GL ownership
- Store submission with real Play/ASC secrets

---

## Admin URLs

| Surface | URL |
|---|---|
| Access governance | `/admin/access`, `/admin/access/governance` |
| Audit Trail search | `/admin/audit-trail` |
| Security alerts | `/admin/audit-trail/alerts` |
| Forensic cases | `/admin/audit-trail/forensics` |
| Event holds | `/admin/audit-trail/holds` |
| Audit governance | `/admin/audit-trail/governance` |

---

## Ship evidence

| Field | Value |
|---|---|
| Feature SHA | `ea14a15` (`feat/residual-closeout`) |
| Prod HEAD after FF | `ea14a15` on `SADCPFNexus/main` |
| API health | `200` (`http://127.0.0.1:8000/up`) |
| Web health | `307` (`http://127.0.0.1:3000/`) |
| Test evidence | AccessControl + AuditTrail + residual suites: **69 passed / 283 assertions** (PolicyDecisionPoint, ResidualCloseoutAccessControl, DelegationCollapse, PlatformAuditTrail Phase1+Phase2 MVP, AccessControlNegative/Persona included in filter run) |
| Deploy backup | `/home/sadcpf-nexus/backups/databases/pre-deploy-20260731-082128.sql.gz` |
