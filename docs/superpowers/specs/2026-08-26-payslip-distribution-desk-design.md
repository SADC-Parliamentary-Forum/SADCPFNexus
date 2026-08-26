# Payslip distribution desk — design

**Date:** 2026-08-26  
**Branch:** `cursor/payslip-distribution-desk-8aae`

## Problem

`/finance` and payslip pages do not share Leave/Travel register chrome. HR upload requires a rigid `EMP042_March2026.pdf` filename and client-side matching against a 200-user dump, with no way to assign unmatched files to a person.

## Approach (chosen)

**Pay-period envelope.** HR picks the month once, drops PDFs (or a ZIP), the API matches filenames to tenant staff, unmatched rows get a people picker, then one Issue action writes the files. Staff see a RegisterShell of their own slips.

Rejected alternatives: keep per-file period fields (error-prone); OCR-from-PDF matching (OCR driver is null; would invent text).

## Surfaces

| Role | Route | Purpose |
|------|--------|---------|
| Staff | `/finance/payslips` | Own history, year chips, download |
| Staff | `/finance/payslips/[id]` | Viewer aligned with module chrome |
| HR / Admin | `/hr/payslips` and `/admin/payslips` | Shared distribution desk |
| Everyone | `/finance` | Hub cards + my-payroll strip (not a one-off dashboard) |

Admin remains the control plane: upload, assign, confirm, delete stay on `/api/v1/admin/payslips*`. Clients do not write the database.

## API

- `POST /api/v1/admin/payslips/match` — filenames + period → matched / ambiguous / unmatched + existing-slip flag
- `GET /api/v1/admin/payslips/directory?q=` — tenant staff search (id, name, email, employee_number)
- `GET /api/v1/admin/payslips/period-coverage` — issued vs missing for the period
- `POST /api/v1/admin/payslips/distribute` — files[] and/or zip + assignments JSON; tenant-scoped; zip-slip rejected
- Existing `POST /admin/payslips` kept for single re-upload
- List filters: `period_month`, `period_year`, `confirmation_status`

Matching: employee number in filename (`EMP123`, `SADC-0042`, non-year digits), then unique name-token match. Ambiguous names stay unmatched until HR picks. Never auto-assign across tenants.

ZIP envelopes are unpacked at preview time so HR can assign inner files before Issue. When assignments are sent, they are authoritative: unassigned inner files are skipped even if the filename would match. Duplicate files for the same person are skipped. Missing-staff list can assign the next unassigned file with one click. Duplicate employee numbers stay unmatched until HR picks.

## Explicitly not in this change

Live OCR of PDF body, payroll-vendor auto-ingest, mobile HR upload parity, collapsing `/finance` vs `/salary-advances` dual surfaces, inventing net/gross from PDFs.
