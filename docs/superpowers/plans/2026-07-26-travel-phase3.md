# Travel Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Travel Phase 2 deferrals — practical itinerary parsing, FX rate feeds with DSA snapshots, minimal health pack, soft procurement link.

**Architecture:** Extend Travel services/controllers/models; additive migrations; replace null stubs with practical/configurable implementations; keep Phase 1/2 workflow locks.

**Tech Stack:** Laravel API, Next.js web, DomPDF, PHPUnit.

**Branch:** `feat/travel-phase3-2026-07-26`

---

### Task 1: Docs + migration

**Files:**
- Create: `docs/superpowers/specs/2026-07-26-travel-phase3-design.md`
- Create: `docs/superpowers/plans/2026-07-26-travel-phase3.md`
- Create: `api/database/migrations/2026_07_26_160001_travel_phase3_parser_fx_health_procurement.php`

- [ ] Migration: travel_requests health + procurement + itinerary_version columns; itinerary parse columns; travel_fx_rates table; dsa_lines FX snapshot columns; app_user grants.

---

### Task 2: Airline parser (TDD)

**Files:**
- Create: `api/app/Modules/Travel/Services/PracticalAirlineItineraryParser.php`
- Create: `api/app/Modules/Travel/Services/TravelItineraryParseService.php`
- Modify: bind in `AppServiceProvider`
- Test: `api/tests/Feature/Travel/TravelPhase3Test.php`

- [ ] Parse structured / ICS / confirmation paste → legs; empty/unparseable → soft fail `[]` + message
- [ ] Apply replaces legs, bumps `itinerary_version`, audits

---

### Task 3: FX rates (TDD)

**Files:**
- Create: `TravelFxRate` model, `ConfigurableFxRateFeed`, optional `HttpFxRateProvider`
- Modify: `TravelDsaService` snapshot FX on lines
- Modify: `config/travel.php` for HTTP URL/token env keys
- API: list/upsert fx-rates

---

### Task 4: Health pack (TDD)

**Files:**
- Permission `travel.health-view` in RolesAndPermissionsSeeder
- `TravelHealthService` + PATCH health
- Strip health fields from show for unauthorized
- PDF section when any health data present

---

### Task 5: Procurement soft link (TDD)

**Files:**
- PATCH procurement-link; threshold hint via config
- Detail UI link panel

---

### Task 6: Web UI + API client

- Detail: itinerary paste, health, procurement panels
- Settings: FX rate form
- `travelApi` methods
- Light e2e smoke selectors

---

### Task 7: Verify, commit, merge, deploy

- PHPUnit Travel Phase 3 (+ Phase 1/2 smoke)
- Commit (exclude `.ship-safe/context.json`, `.claude/settings.json`)
- Push → merge main → deploy `sadcpf-nexus-prod` → `/up`

---

## Completion note (2026-07-26 — Phase 3 stream)

Shipped on `feat/travel-phase3-2026-07-26` after Phase 2 live at `fd97a3f`.

**Done:** Practical airline itinerary parser (ICS/structured/paste) with versioned replace + audit; configurable FX table + optional HTTP provider; DSA line FX snapshots; minimal health pack with restricted visibility + PDF section; soft procurement link fields/UI; TravelPhase3Test (6) + Phase 2 regression green.

**Deferred:** Paid GDS/airline booking APIs; live paid FX vendor SDKs; full medical EHR pack; travel-agent marketplace.
