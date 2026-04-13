# SADC PF Nexus — What's Left to Do

**App status: active development.** Core flows complete. Performance Tracker and HR Personal File System modules added 2026-03-12.

---

## Completed (reference)

- **Web:** Auth proxy, login + cookie, dashboard (user + stats from API), travel/leave/imprest/procurement list–detail–create wired to API, admin users/departments/roles wired, finance advances list + create, finance payslips (list + download), finance summary, HR home + timesheets wired, HR summary, leave balances, LIL accruals from API, imprest summary stats, and the dedicated imprest liquidation page is API-driven. Table dates use human-readable formatting; sidebar is collapsible (icon-only when minimised).
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

## 2b. Mobile — Completed (previously future scope)

The following are now wired to the API:

| Area | Status |
|------|--------|
| **Offline drafts** | Drift DB; OfflineDraftsScreen loads from DB, Sync All POSTs to travel/leave/imprest/procurement and removes on success. **Save as draft** in travel, leave, and imprest forms; **Continue Editing** opens the matching form with payload and clears draft on submit. |
| **Support** | List and New Ticket already call `/support/tickets`; response shape verified (paginated). |
| **Governance** | Meetings wired; Plenary Resolutions and Resolutions Oversight screens load from `GET /governance/resolutions`. Tapping a resolution opens the detail screen with the selected resolution passed via route extra. |
| **Assets** | Asset inventory screen loads from `GET /assets` (My Assigned + All); My Assigned Assets was already wired. |
| **HR incidents** | List and quick-report dialog wired; Report New Incident full form submits via `POST /hr/incidents`. Disciplinary case screen remains UI-only. |

---

## 3. API — Optional additions

| Item | Status |
|------|--------|
| **Reports** | Done. `GET /api/v1/reports/travel`, `reports/leave`, `reports/dsa` with query `period_from`, `period_to`, `per_page`; summary unchanged. |
| **Payslip files** | Done. Admin drag-and-drop upload at `/admin/payslips/`. Staff view + PDF inline viewer at `/finance/payslips/[id]/`. Mobile download via `GET /finance/payslips/{id}/download`. Storage: `storage/app/payslips/{tenant_id}/{user_id}/`. |
| **Vendor Register enhancements** | Done (2026-04-07). Expanded vendor profile (contact person, VAT, country, category, website, banking details, SME flag, notes). 5-star staff rating system (`vendor_ratings` table, one per user per vendor, aggregate avg shown in list). New migrations: `2026_04_07_100000`, `2026_04_07_100001`. Run `php artisan migrate`. |

---

## 4. Documentation and quality

- **REMAINING_WORK.md:** Kept as single source of truth; update as items are completed or new work is added. Next.js dynamic route params are aligned with the async pattern used by Next 16.
- **Android release:** Release signing is configured in `mobile/android/app/build.gradle.kts` with a placeholder; add your keystore and set `SADC_KEYSTORE_*` (or configure `signingConfigs.release` manually) when publishing to production. See [mobile/RELEASE.md](mobile/RELEASE.md) for keystore creation and build steps.

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
| Optional/future (Mar 2026) | `mobile/RELEASE.md` (Android signing); `api/app/Http/Controllers/Api/V1/ReportsController.php` (travel, leave, dsa); `mobile/lib/core/offline/draft_provider.dart`, `offline_drafts_screen.dart` (Drift + Sync All); `mobile/lib/features/hr/presentation/screens/report_new_incident_screen.dart` (Submit to API); `mobile/lib/features/assets/presentation/screens/asset_inventory_screen.dart` (GET /assets); `mobile/lib/features/governance/presentation/screens/plenary_resolution_dashboard_screen.dart`, `resolutions_oversight_screen.dart` (GET /governance/resolutions) |
