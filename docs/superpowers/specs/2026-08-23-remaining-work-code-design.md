# Remaining implementable product — design

**Date:** 2026-08-23  
**Branch:** `feat/remaining-work-code`  
**Baseline:** `SADCPFNexus/main` @ `d6185d4`

## What this ships

Code that does not require operator signatures, live vendor secrets, or IA owner decisions:

1. **PR-23 / MD-16 (analytics)** — `GET /api/v1/lifecycle/analytics` plus labelled cycle-time, bottleneck, and clearance-aging KPIs on `/lifecycle/reports`.
2. **MD-16 (journeys)** — transfer / promotion / probation templates and `POST /api/v1/lifecycle/journeys` (HR `lifecycle.manage-onboarding`).
3. **PR-24** — stamp FlateDecode (compressed) PDF content streams in `DocumentWatermarkPainter` so compressed downloads are no longer a passthrough.

## Explicitly not in this change

- Forging UAT / IDOR / restore-drill / AC-8–10 evidence (GL-1–GL-7, GL-13 deploy is ops).
- Inventing IMAP/AV/FCM/SMS/WhatsApp/LLM/SIEM/Sentry/store secrets (GL-8–12, CR-*).
- Marking Admin governance rows Done (GV-*).
- Collapsing dual surfaces / calendars / settings IA (UX-T*).
- Locked OOS (FA↔Stock, bank GL, auto-award, paid GDS, full mobile parity, instalments, etc.).

## Analytics contract

`data.by_type.{onboarding,separation,transfer,promotion,probation}` each has `open`, `completed`, `avg_cycle_days` (null when none completed).  
`data.bottlenecks` is open tasks grouped by `task_key` with `open_count` and `avg_age_days`, max 8, ordered by age.  
`data.clearance_aging` buckets `0_7`, `8_14`, `15_plus` for in-progress separation cases.  
`data.exceptions_open` counts unresolved exceptions for the tenant.

Tenant-scoped. `lifecycle.view` required. No employee league tables.

## Journeys

Default template codes: `transfer-internal`, `promotion`, `probation-review`. Cases reuse the existing task engine. No invented payroll rates.

When every mandatory task on a transfer, promotion, or probation case is completed, the case status becomes `completed` (so analytics cycle time is not stuck on open lists). Reopening a task returns the case to `in_progress`. Separation still uses the clearance/finalise path.

`GET /api/v1/lifecycle/dashboard` includes `internal_open`. HR can start journeys from `/lifecycle/journeys/new` and review the queue at `/lifecycle/journeys`.

## Watermark

If a PDF stream is `/Filter /FlateDecode`, inflate, inject the same visible text operator used for uncompressed PDFs, deflate, and rewrite `/Length`. Uncompressed path unchanged. If inflate fails, return original bytes (headers still mark watermarked).
