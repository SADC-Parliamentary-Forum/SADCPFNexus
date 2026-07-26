# Travel Phase 3 — Design

**Date:** 2026-07-26  
**Status:** Locked — implement after Phase 2 live at `fd97a3f`  
**PRD:** §92 Phase 2 deferrals (airline parse, FX, health, procurement link)  
**Baseline:** `feat/travel-phase3-2026-07-26` from `main` @ `fd97a3f`  
**System:** SADC PF Nexus — extend existing Travel module (no rewrite)

**Approval:** User said **Proceed** after Travel Phase 2 go-live.

---

## Assumptions / Decisions (Locked)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Delivery scope** | Close Phase 2 deferrals only: practical itinerary parsing, FX rate table + optional HTTP feed, minimal health pack, soft procurement link. |
| 2 | **Phase 1/2 locks** | TOIL never auto-creates leave; Finance owns DSA (SoD); SG gate / booking before SG unchanged; HOD → Admin → Finance → Dir Finance → SG unchanged. |
| 3 | **Airline / GDS** | Local practical parser for pasted confirmation / ICS / structured text only. **No** paid GDS, Amadeus, Sabre, or vendor API keys. |
| 4 | **FX** | Tenant rate table (manual/admin default). Optional HTTP provider via env URL/token — never hardcode paid API keys. Snapshot rates onto DSA lines at calculation time. |
| 5 | **Health** | Minimal vaccination/prophylaxis flags + cost + status. Restricted visibility (`travel.health-view` / HR / Admin / Finance / requester / System Admin). PDF section only when data present. |
| 6 | **Procurement** | Soft FK link fields + UI when thresholds suggest booking via procurement — **not** a marketplace or travel-agent catalog. |
| 7 | **Salary Advance / Procurement core** | Do not modify procurement award/threshold engines except documented soft link from Travel. |

---

## Approaches

### A — Docs-only deferral again
Rejected — Phase 2 already deferred; user Proceed.

### B — Coherent Phase 3 slice on existing core (**chosen**)
Ship parser + FX table + health fields + procurement soft link with PHPUnit + light UI.

### C — Live GDS / paid FX / full medical EHR
Rejected — out of scope; no secrets/vendor SDKs.

---

## Domain model (additions)

```
travel_requests
  + itinerary_version (int, default 0)
  + itinerary_raw_source (text, nullable) — last paste/ICS applied
  + health_vaccination_required (bool)
  + health_vaccination_status (nullable string)
  + health_prophylaxis_required (bool)
  + health_prophylaxis_status (nullable string)
  + health_estimated_cost (decimal nullable)
  + health_notes (text nullable)
  + health_cleared_at (timestamp nullable)
  + procurement_request_id (nullable FK)
  + procurement_link_reason (text nullable)
  + procurement_link_required (bool default false)

travel_itineraries
  + flight_number, carrier, departure_at, arrival_at (nullable)
  + parse_source (nullable string: paste|ics|structured|manual)
  + itinerary_version (int)

travel_fx_rates
  tenant_id, from_currency, to_currency, rate, effective_date,
  source (manual|http), notes, created_by, timestamps

travel_dsa_lines
  + fx_from_currency, fx_to_currency, fx_rate, fx_as_of (nullable snapshot)
```

---

## API surface (Phase 3)

| Endpoint | Purpose |
|----------|---------|
| `POST /travel/requests/{id}/parse-itinerary` | Preview legs from raw text (fail soft) |
| `POST /travel/requests/{id}/apply-itinerary` | Replace legs, bump version, audit |
| `GET/POST /travel/fx-rates` | List / upsert manual FX rates (Finance/Admin) |
| `PATCH /travel/requests/{id}/health` | Update health pack (restricted writers) |
| `PATCH /travel/requests/{id}/procurement-link` | Soft-link / unlink procurement request |
| Existing `POST …/dsa` | Snapshots FX onto lines when currencies differ |

---

## UI paths

| Path | Audience |
|------|----------|
| `/travel/[id]` — paste itinerary panel | admin-review / owner |
| `/travel/[id]` — health pack panel | health-view roles |
| `/travel/[id]` — procurement link panel | admin / finance / owner |
| `/travel/settings` — FX rate register | finance-review |
| PDF Parts A–D + Health section if present | certificate viewers |

---

## Explicitly deferred (later)

- Paid GDS / airline booking APIs  
- Live paid FX vendor SDKs with embedded keys  
- Full medical / EHR health pack  
- Travel-agent marketplace  

---

## Spec self-review

- No paid API keys in repo.  
- TOIL auto-leave remains false.  
- Finance DSA SoD unchanged.  
- Health fields redacted for unauthorized viewers.  
- Procurement link is soft FK only.
