# SADC PF Nexus — What's Left to Do

Summary of remaining work as of the latest implementation. Core flows are **done**: auth, dashboard, travel, leave, imprest, procurement, admin, finance (payslips, advances, summary), HR (timesheets, summary, leave balances), leave LIL accruals, and mobile Reports hub.

---

## Completed (reference)

- **Web:** Auth middleware, login + cookie, dashboard (user + stats from API), travel/leave/imprest/procurement list–detail–create wired to API, admin users/departments/roles wired, finance advances list + create, finance payslips (list + download), finance summary (current net salary, YTD gross, gross for advance form), HR home + timesheets wired to `hrApi`, HR summary (hours this month, overtime MTD, leave balances), leave balances on leave page, leave create LIL accruals from API, imprest summary stats from `requests`.
- **Mobile:** Real login (API + token), biometric, ApiClient + 401 handling, profile (user + logout), Requests and Approvals screens, dashboard (user name + stats from API), Reports hub screen (travel/leave/DSA/finance report types).
- **API:** Auth, admin, travel, leave (balances, LIL accruals from overtime_accruals), leave_balances and overtime_accruals tables, imprest, procurement, finance (advances, payslips, summary), HR (timesheets, summary), dashboard stats, seeders (roles, demo tenant, demo data, payslips, leave balances, overtime accruals).

---

## 1. Web — Remaining (optional)

| Item | Priority | Notes |
|------|----------|--------|
| *(None)* | — | Finance payslips, salary/YTD, advance gross, leave balances, HR stats, and LIL accruals are now API-driven. |

---

## 2. Mobile — Remaining (optional)

| Item | Priority | Notes |
|------|----------|--------|
| *(None)* | — | Reports hub screen is implemented; individual report screens can be added when a reports API exists. |

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

## 5. Files touched (reference)

| Area | Files |
|------|--------|
| API payslips | `api/database/migrations/2026_03_02_210000_create_payslips_table.php`, `api/app/Models/Payslip.php`, `api/app/Http/Controllers/Api/V1/Finance/PayslipController.php`, `api/app/Http/Controllers/Api/V1/Finance/FinanceSummaryController.php`, routes, DemoDataSeeder |
| API leave | `api/database/migrations/2026_03_02_210001_create_leave_balances_table.php`, `api/app/Models/LeaveBalance.php`, `api/app/Http/Controllers/Api/V1/Leave/LeaveController.php` (balances), `api/database/migrations/2026_03_02_210002_create_overtime_accruals_table.php`, `api/app/Models/OvertimeAccrual.php`, LeaveController::lilAccruals, DemoDataSeeder |
| API HR | `api/app/Http/Controllers/Api/V1/Hr/HrSummaryController.php`, routes |
| Web finance | `web/app/(app)/finance/page.tsx`, `web/app/(app)/finance/payslips/page.tsx`, `web/app/(app)/finance/advances/create/page.tsx`, `web/lib/api.ts` |
| Web leave | `web/app/(app)/leave/page.tsx`, `web/lib/api.ts` |
| Web HR | `web/app/(app)/hr/page.tsx`, `web/lib/api.ts` |
| Mobile reports | `mobile/lib/features/reports/presentation/screens/reports_screen.dart`, `mobile/lib/core/router/app_router.dart` |
| Android | `mobile/android/app/build.gradle.kts` (release signing config) |
