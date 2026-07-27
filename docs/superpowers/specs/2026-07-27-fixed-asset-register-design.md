# Fixed Asset Register Phase 1 — Design

**System:** SADC PF Nexus  
**Module:** Fixed Asset Register & Asset Lifecycle Management  
**Slice:** Phase 1 (PRD §113)  
**Date:** 2026-07-27  
**Status:** Approved for implementation (parent task mandate)  
**PRD:** `docs/superpowers/specs/2026-07-27-fixed-asset-register-prd.md`

---

## Gap analysis (existing Assets vs PRD)

| Area | Existing | Gap |
|------|----------|-----|
| Register CRUD | Yes (`assets`, categories, QR) | Missing class, serial, tag, funding, location structure, lifecycle breadth |
| GRN handoff | Creates 1 pending FA draft OR stock | Must create **N assets for qty N**; classify capital vs controlled vs stock |
| Capitalise/reject | `AssetService` + pending status | Must apply **versioned capitalisation policy**; set `asset_class` |
| Depreciation | On-the-fly straight-line accessor | Need versioned rates + **depreciation run** records (monitoring only) |
| Assignment | `assigned_to` overwrite | Need **immutable assignment history** + acknowledgement |
| Movements | `asset_movements` | Keep; add structured locations + location history |
| Disposal | Soft-retire via DELETE | Need **disposal workflow** (request → HOD → Finance → SG) |
| Verification / maintenance / warranty | Missing | New tables + APIs |
| Reports | Basic reports controller | Register export CSV/JSON |
| Stock | Separate module | Keep separate — never put consumables in FA |
| Nav | Flat Assets menu | Expand to PRD §5 Fixed Assets submenu |

**Approach:** Evolve existing `assets` tables and `App\Modules\Assets` in place. Do not recreate procurement. Do not merge Stock into FA.

---

## Decisions locked

| Topic | Choice |
|-------|--------|
| Schema strategy | Evolve `assets` + add satellite tables |
| Capitalisation threshold | Versioned `asset_capitalisation_policies` (seed default USD 250) — never hard-coded in business logic |
| One physical unit | GRN `fixed_asset` handoff uses `quantity` (default 1) → N pending rows |
| Classification | `asset_class`: `capital` \| `controlled` \| null until classified; consumables stay type=`stock` handoff |
| Status compatibility | Keep `pending` / `active` / `retired` / `loan_out` / `service_due`; add lifecycle values (`available`, `assigned`, `missing`, `damaged`, `pending_disposal`, `disposed`, …) |
| Custody history | Append-only `asset_assignment_histories`; never UPDATE closed rows |
| Location history | Append-only `asset_location_histories` |
| Deletion | Ordinary DELETE remains soft-retire; disposed assets cannot be hard-deleted |
| Depreciation | Nexus calculates for monitoring; official GL stays accounting system |
| Disposal | `asset_disposals` workflow; asset status transitions; no register hard-delete |
| Phase 2 stubs | Insurance deep workflow, fleet, endpoint mgmt, mobile bulk scan — nav stubs only |
| Permissions | Reuse `assets.*`; add `assets.verify`, `assets.maintain`, `assets.transfer` if missing |

---

## Architecture

```
Procurement GRN accept
  └─ handoff type=fixed_asset (+qty) → N × Asset(status=pending)
  └─ handoff type=stock → Stock module (unchanged)

AssetService
  ├─ classify / capitalise (policy-driven class)
  ├─ register / tag
  ├─ assign / acknowledge / transfer / return
  ├─ markMissing / markDamaged
  └─ destroy → retire only

AssetCapitalisationPolicyService — active policy at date
AssetDepreciationService — policy rates + run
AssetDisposalService — request → recommend → finance → approve → complete
AssetVerificationService — campaigns + results
AssetMaintenanceService — maintenance + warranty fields
```

Web: `/assets` hub with sub-routes matching PRD §5 Phase 1 screens.

---

## Data model (Phase 1)

**Extend `assets`:** `asset_class`, `serial_number`, `tag_number`, `manufacturer`, `model`, `condition`, `funding_source`, `donor_name`, `donor_restrictions`, `location_id`, `department`, `warranty_expiry`, `warranty_provider`, `capitalisation_policy_id`, `accumulated_depreciation`, `book_value`, `last_verified_at`, `acknowledgement_at`, `currency`

**New tables:**
- `asset_capitalisation_policies`
- `asset_depreciation_rate_policies` (+ category rates JSON or child rows)
- `asset_locations`
- `asset_assignment_histories`
- `asset_location_histories`
- `asset_disposals`
- `asset_verification_campaigns` + `asset_verification_results`
- `asset_maintenance_records`
- `asset_depreciation_runs` + `asset_depreciation_run_lines`

---

## Testing (TDD critical rules)

1. Capitalisation policy classifies capital vs controlled by threshold  
2. GRN qty 20 → 20 assets  
3. Tag uniqueness per tenant  
4. Assignment creates history; reassignment closes prior row (no overwrite of history)  
5. Disposal gates (cannot skip Finance/SG when required)  
6. Serial duplicate warn/prevent  
7. Soft-retire only; disposed not reassigned  

---

## Assumptions

1. Default policy threshold USD 250 until Finance configures otherwise.  
2. `active` status remains valid synonym for registered/in-service assets.  
3. Temporary loans reuse `loan_out` + movements; full loan submodule deferred polish.  
4. Offboarding check = API `GET /assets?assigned_to={user}` + profile widget if Users page exists.  
5. Insurance deep workflow deferred (Phase 2 stub).  
6. Official accounting posting out of scope.  
