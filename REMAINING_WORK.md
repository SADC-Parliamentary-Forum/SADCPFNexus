# SADC PF Nexus — What's Left to Do

**App status: finalised.** All core flows are implemented and wired to the API. Remaining items are optional (release signing, payslip PDFs) or future scope (governance, assets, offline, support).

---

## Completed (reference)

- **Web:** Auth middleware, login + cookie, dashboard (user + stats from API), travel/leave/imprest/procurement list–detail–create wired to API, admin users/departments/roles wired, finance advances list + create, finance payslips (list + download), finance summary, HR home + timesheets wired, HR summary, leave balances, LIL accruals from API, imprest summary stats. Table dates use human-readable formatting; sidebar is collapsible (icon-only when minimised).
- **Mobile:** Login (API + token), biometric, ApiClient + 401 handling, profile, Requests and Approvals, dashboard, Reports hub + report detail from API. Leave, Imprest, Procurement, Salary Advance forms and PIF form/review submit to API. Leave balance screen and **HR timesheets and payslip screens** load from API. Friendly date formatting; no unused placeholder screens. **Runs on Android, iOS, web (Chrome), and Windows** when no device is connected (use `flutter run -d chrome` or `flutter run -d windows`).
- **API:** Auth, admin, travel, leave (balances, LIL), imprest, procurement, finance (advances, payslips, summary), HR (timesheets, summary), programmes (PIF), dashboard stats, CORS, seeders.

---

## 1. Web — Remaining (optional)

| Item | Priority | Notes |
|------|----------|--------|
| *(None)* | — | Finance payslips, salary/YTD, advance gross, leave balances, HR stats, and LIL accruals are now API-driven. |

---

## 2. Mobile — Remaining (optional)

| Item | Priority | Notes |
|------|----------|--------|
| *(None)* | — | Reports hub navigates to report detail screen (data from existing list APIs). Leave, Imprest, Procurement, Salary Advance forms and PIF form/review are API-wired. |

---

## 2b. Mobile — UI-only / future scope (documented)

The following mobile screens are **UI-only** (no backend integration yet). Implement when product requires:

| Area | Current state | To wire |
|------|----------------|--------|
| **Offline drafts** | Hardcoded draft list; "Sync All" is a fake delay. | Add local persistence (e.g. Drift/SQLite), real sync that POSTs to travel/leave/imprest endpoints and clears local state. |
| **Support & health** | Hardcoded tickets, system checks, FAQs; "New ticket" is no-op. | Add support/ticketing API and (optionally) health endpoint; wire mobile to them. |
| **Governance** | No API client in feature; API has no governance routes. | Add governance endpoints when required; wire delegation/meetings, resolutions, compliance screens. |
| **Assets** | No API client in feature; API has no assets routes. | Add assets API (inventory, assignments, condition reports, fleet); wire mobile screens. |
| **HR incidents** | Timesheets and payslip are API-wired. Incident/disciplinary screens are UI-only. | Add incident/disciplinary API if required; wire Report New Incident and Disciplinary Case screens. |

---

## 3. API — Optional additions

| Item | When needed |
|------|-------------|
| **Reports** | If adding a dedicated reports flow: endpoints for travel/leave/DSA or other report data; mobile hub can then link to report list/detail. |
| **Payslip files** | Payslips table and list/download endpoint exist; attach real PDF files via `file_path` and storage when payroll integration is ready. |

---

## 4. Documentation and quality

- **REMAINING_WORK.md:** Kept as single source of truth; update as items are completed or new work is added.
- **Android release:** Release signing is configured in `mobile/android/app/build.gradle.kts` with a placeholder; add your keystore and set `SADC_KEYSTORE_*` (or configure `signingConfigs.release` manually) when publishing to production.

---

## 5. Tests added (reference)

- **API:** `tests/Feature/Leave/LeaveRequestTest.php` (create, list, balances), `tests/Feature/Travel/TravelRequestTest.php` (create, list). Run with `php artisan test`; requires PHP SQLite extension for in-memory DB.
- **Mobile:** `mobile/test/features/reports_screen_test.dart` (Reports screen title and report types). Run with `flutter test`.

---

## 6. Files touched (reference)

| Area | Files |
|------|--------|
| API payslips | `api/database/migrations/2026_03_02_210000_create_payslips_table.php`, `api/app/Models/Payslip.php`, `api/app/Http/Controllers/Api/V1/Finance/PayslipController.php`, `api/app/Http/Controllers/Api/V1/Finance/FinanceSummaryController.php`, routes, DemoDataSeeder |
| API leave | `api/database/migrations/2026_03_02_210001_create_leave_balances_table.php`, `api/app/Models/LeaveBalance.php`, `api/app/Http/Controllers/Api/V1/Leave/LeaveController.php` (balances), `api/database/migrations/2026_03_02_210002_create_overtime_accruals_table.php`, `api/app/Models/OvertimeAccrual.php`, LeaveController::lilAccruals, DemoDataSeeder |
| API HR | `api/app/Http/Controllers/Api/V1/Hr/HrSummaryController.php`, routes |
| Web finance | `web/app/(app)/finance/page.tsx`, `web/app/(app)/finance/payslips/page.tsx`, `web/app/(app)/finance/advances/create/page.tsx`, `web/lib/api.ts` |
| Web leave | `web/app/(app)/leave/page.tsx`, `web/lib/api.ts` |
| Web HR | `web/app/(app)/hr/page.tsx`, `web/lib/api.ts` |
| Mobile reports | `mobile/lib/features/reports/presentation/screens/reports_screen.dart`, `mobile/lib/core/router/app_router.dart` |
| Mobile HR       | `mobile/lib/features/hr/presentation/screens/timesheets_incidents_screen.dart`, `payslip_screen.dart` (API-wired); `path_provider` added for payslip PDF save |
| Android | `mobile/android/app/build.gradle.kts` (release signing config) |
| Tests   | `api/tests/Feature/Leave/LeaveRequestTest.php`, `api/tests/Feature/Travel/TravelRequestTest.php`, `mobile/test/features/reports_screen_test.dart` |
