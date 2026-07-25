# M&E / Results Monitoring Module — Design

**Date:** 2026-07-25  
**Status:** Approved for Phase 1 implementation  
**PRD:** Full Updated Product Requirements Document (user-supplied, 2026-07-25)  
**System:** SADC PF Nexus

---

## Decisions (brainstorm)

| Decision | Choice |
|----------|--------|
| Delivery ambition | Design Phases 1–3; **implement Phase 1 first** |
| Backend strategy | **Extend** existing MandE API/schema (do not replace) |
| PIF intake | **Configurable** auto-create on final approve; **default ON**; idempotent |
| Non-PIF reports | **Phase 2** (documented only now) |
| Programme Manager review | **Configurable**; **default OFF** |
| Implementation approach | **Foundation then Phase 1 UI** |

---

## 1. Architecture

### Ownership

- **PIF (`Programme`)** owns planning, costing, approval. After final approval, PIF data is **immutable** from M&E’s perspective.
- **M&E** owns strategic configuration, results frameworks, indicators/targets, activity reporting, actuals, evidence, review, reporting status, institutional/donor reports.
- Connection: `MeActivityReport.programme_id` (owns the link). PIF exposes read-only `me_status` only. **No M&E indicator/target columns on `programmes`.**

### Event flow

```
PIF final approve
  → if settings.auto_intake: create MeActivityReport shell (unique programme_id, idempotent)
  → always: notifications (officer + mande.create) — already partially present
  → Intake / Report Pending when activity end date passes
  → Draft → [optional PM] → M&E Review → Accept → Close
```

### Hard rules

1. M&E never updates approved PIF columns.
2. Actuals and variances live only on M&E records.
3. At most one active M&E report per PIF (`programme_id` unique among non-deleted reports).
4. Permissions enforced server-side.
5. Same user must not be Reporting Officer and final accepter (audited exception only).

---

## 2. Phase map

### Phase 1 — Production-critical (implement now)

- Separate M&E main menu (unhide full Phase 1 nav; drop EXTRA flag for Phase 1 routes)
- Settings: auto-intake, due-date offset days, PM-review toggle
- Idempotent auto-intake on PIF approve
- Intake Queue UI (`/mande/pif-linkages` / `/mande/intake`)
- Activity report list + wizard UI (sections A–M, progressive disclosure)
- Evidence upload/review UI
- Review queue (return with section/reason/action/due; accept; close)
- Strategic Plans / Results Frameworks / Indicators admin UI (Indicators exists)
- Basic dashboards (extend existing)
- Basic institutional report export (where API supports; PDF/CSV/Excel as available)
- Audit trail (extend existing AuditLog usage)
- Permission expansion mapped onto legacy `mande.view|create|review|admin`

### Phase 2 — Designed, not built in this stream

- Non-PIF activity reports
- Follow-up action entity + analytics
- Data-quality scoring module
- Donor report builder
- Historical import (Excel/CSV)
- Indicator versioning UI
- Programme Manager review gate (setting exists in P1; full PM queue UX can deepen in P2)
- Reporting calendar advanced rules

### Phase 3 — Optional

- AI-assisted summarisation / narrative drafts / metadata extraction — **human review mandatory**
- Predictive overdue risk; NL dashboard queries

---

## 3. Status model

### Keep existing core statuses (compat)

`not_submitted` | `submitted` | `returned` | `reviewed` | `accepted` | `closed`

### Phase 1 extensions (additive columns / values)

| Need | Approach |
|------|----------|
| Intake pending | Report shell with `not_submitted` + `intake_confirmed_at` null; dashboard treats unconfirmed shells as intake |
| Draft vs not started | Use existing draft semantics (`not_submitted` + incomplete); optional `draft_step` for wizard |
| Not reportable | `review_status=not_reportable` + `not_reportable_reason` + actor/timestamp |
| Cancelled activity | `review_status=cancelled` + reason; PIF unchanged |
| Archived | Soft-delete or `archived_at` (prefer `archived_at` to preserve link) |
| PM review | When setting on: intermediate `submitted_for_programme_review` or reuse `submitted` + `programme_review_status` |

### Programme `me_status` mapping

Extend `Programme::getMeStatusAttribute` for new statuses; keep existing labels for current six. Unknown → `link_unavailable`.

---

## 4. Settings

Tenant-scoped M&E settings (new table or `tenant_settings` key `mande`):

| Key | Default | Meaning |
|-----|---------|---------|
| `auto_intake` | `true` | Create report shell on final PIF approve |
| `report_due_days` | `14` | Days after actual/approved end date |
| `programme_manager_review` | `false` | Require PM before M&E |

Admin UI: `/mande/settings` (`mande.admin`).

---

## 5. Components (Phase 1 web)

| Route | Purpose |
|-------|---------|
| `/mande` | Dashboard |
| `/mande/intake` | Intake queue (alias of pif-linkages UI) |
| `/mande/activity-reports` | All / filterable list |
| `/mande/activity-reports/mine` | My reports |
| `/mande/activity-reports/create` | Create (from PIF id query) |
| `/mande/activity-reports/[id]` | Wizard + history |
| `/mande/review-queue` | Pending M&E review |
| `/mande/strategic-plan` | Plans + hierarchy |
| `/mande/results` | Results frameworks |
| `/mande/indicators` | Exists |
| `/mande/reports` | Institutional exports |
| `/mande/settings` | Settings |

Remove reliance on `NEXT_PUBLIC_ENABLE_MANDE_EXTRA` for Phase 1 routes; gate by permissions only.

---

## 6. API evolution (extend)

1. `GET/PUT /mande/settings`
2. On `ProgrammeService::approve`: if auto_intake, call `MeIntakeService::ensureForProgramme($programme)` (unique guard)
3. `POST /mande/intake/{programme}/not-reportable`
4. Enrich return payload: `section`, `required_action`, `correction_due_at`
5. Enforce SoD on `accept`
6. Seed/alias finer permissions → existing four for Phase 1 compatibility
7. Optional reminder command/job for overdue reports (Phase 1 minimal: artisan + schedule)

Existing CRUD for plans/frameworks/indicators/reports/evidence remains authoritative.

---

## 7. Error handling & security

- Validation errors → 422 with field keys matching wizard sections
- Duplicate intake → 200/201 idempotent return of existing report (no second row)
- Cross-tenant → 404
- Peer BOLA on reports → 403 (owner, reviewers, `mande.review|admin`)
- Confidential evidence → classification + permission check on download
- Upload sniffing via `UploadContentSniffer` (already on MeEvidenceService)
- Mass assignment: Form Requests only; never accept PIF field writes through M&E

---

## 8. Testing

**Backend:** intake idempotency; settings; SoD accept; return fields; not-reportable; `me_status` mapping; permissions; PIF immutability regression.

**Frontend (Playwright):** intake → create report → prefills → submit → return → resubmit → accept; settings toggle.

**Regression:** PIF approve workflow, existing `ProgrammeMeStatusTest`, MandE feature tests.

---

## 9. Out of scope (this implementation)

- Non-PIF create UI
- Follow-up action CRUD UI
- Data-quality scoring
- Donor report builder / AI
- Changing approved PIF data
- Full grants/accounting systems

---

## 10. Success criteria (Phase 1)

- Approved PIF can auto-create one M&E shell (configurable)
- Officer completes report without re-entering PIF planned fields
- M&E can return/accept/close with audit
- PIF shows accurate read-only `me_status`
- Strategy/framework/indicator config usable in UI
- No writes from M&E into approved PIF columns
