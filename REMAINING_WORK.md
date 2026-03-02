# SADC PF Nexus — What’s Left to Do

Summary of remaining work as of the latest implementation. Most core flows are **done**: auth, middleware, travel/leave/imprest/procurement/admin, finance advances, HR timesheets (web), dashboard stats, mobile login/profile/requests/approvals/dashboard.

---

## Completed (reference)

- **Web:** Auth middleware, login + cookie, dashboard (user + stats from API), travel/leave/imprest/procurement list–detail–create wired to API, admin users/departments/roles wired, finance advances list + create, HR home + timesheets page wired to `hrApi`, imprest summary stats from `requests`, finance page (no fake payslips; “coming soon” + salary/YTD as “—”).
- **Mobile:** Real login (API + token), biometric, ApiClient + 401 handling, profile (user + logout), Requests and Approvals screens, dashboard (user name + stats from API), reports route documented as placeholder.
- **API:** Auth, admin, travel, leave, imprest, procurement, finance advances, HR timesheets, dashboard stats, seeders (roles, demo tenant, demo data).

---

## 1. Web — Remaining (optional)

| Item | Priority | Notes |
|------|----------|--------|
| **Finance – Payslips** | Medium | Currently “Payslips coming soon”. To add: payslips API (list/download), `/finance/payslips` page, and replace placeholder with API data. |
| **Finance – Salary / YTD** | Low | “Current Net Salary” and “YTD Gross” show “—”. Replace when backend or config provides them. |
| **Leave create – LIL accruals** | Low | LIL step uses `MOCK_LIL_ACCRUALS` (documented in code). Replace with API when an LIL accruals endpoint exists. |

---

## 2. Mobile — Remaining (optional)

| Item | Priority | Notes |
|------|----------|--------|
| **Reports screen** | Low | `/reports` still uses `PlaceholderScreen` (documented in router). Implement when a reports hub or reports API exists. |

---

## 3. API — Optional additions

| Item | When needed |
|------|-------------|
| **Payslips** | If implementing web (or mobile) payslips: list, optional download. |
| **LIL accruals** | If replacing the Leave create LIL mock: endpoint for current user’s leave-in-lieu accruals. |
| **Reports** | If adding a dedicated reports flow: endpoints for travel/leave/DSA or other report data. |

---

## 4. Documentation and quality

- **REMAINING_WORK.md:** Kept as single source of truth; update as items are completed or new work is added.
- **Android release:** Add release signing in `mobile/android/app/build.gradle.kts` when publishing.

---

## 5. Files to touch (reference)

| Area | Files |
|------|--------|
| Web payslips | `web/app/(app)/finance/page.tsx`, new `web/app/(app)/finance/payslips/page.tsx`, `web/lib/api.ts` |
| Web LIL | `web/app/(app)/leave/create/page.tsx` (replace mock with API when available) |
| Mobile reports | `mobile/lib/core/router/app_router.dart`, new reports screen if implemented |
| API | New controllers/routes for payslips, LIL accruals, or reports as needed |
